// DDModLauncher: starts Dungeons & Dynasties with WebView2 remote debugging on a random
// localhost port, then injects menu.js into the game page over the Chrome DevTools Protocol.
// Steam launch options:  "C:\path\to\DDModLauncher.exe" %command%
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

const string GameExe = "DungeonsAndDynasties.exe";
const string GameFolder = "Dungeons & Dynasties";
var logPath = Path.Combine(AppContext.BaseDirectory, "DDModLauncher.log");
File.WriteAllText(logPath, $"DDModLauncher {DateTime.Now:u}\n");
void Log(string s) { try { File.AppendAllText(logPath, s + "\n"); } catch { } }

// Folders the game might live in: next to the launcher, then every Steam library.
IEnumerable<string> GameDirCandidates()
{
    yield return AppContext.BaseDirectory;
    var roots = new List<string>();
    try
    {
        using var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
        if (k?.GetValue("SteamPath") is string sp) roots.Add(sp.Replace('/', '\\'));
    }
    catch { }
    roots.Add(@"C:\Program Files (x86)\Steam");
    foreach (var root in roots.Distinct(StringComparer.OrdinalIgnoreCase))
    {
        var libs = new List<string> { root };
        var vdf = Path.Combine(root, "steamapps", "libraryfolders.vdf");
        try
        {
            if (File.Exists(vdf))
                foreach (Match m in Regex.Matches(File.ReadAllText(vdf), "\"path\"\\s*\"([^\"]+)\""))
                    libs.Add(m.Groups[1].Value.Replace(@"\\", @"\"));
        }
        catch { }
        foreach (var lib in libs) yield return Path.Combine(lib, "steamapps", "common", GameFolder);
    }
}

try
{
    // --- locate the game (Steam passes its exe path via %command%) ---
    string? exe = null;
    var passArgs = new List<string>();
    foreach (var a in args)
    {
        if (exe == null && a.EndsWith(GameExe, StringComparison.OrdinalIgnoreCase) && File.Exists(a)) exe = a;
        else if (exe != null) passArgs.Add(a);
    }
    exe ??= GameDirCandidates().Select(d => Path.Combine(d, GameExe)).FirstOrDefault(File.Exists);
    if (exe == null) { Log("Could not find " + GameExe + " in any Steam library. Use the Steam launch option, or put the launcher in the game folder."); return 1; }
    Log("game: " + exe);
    if (args.Contains("--where")) return 0; // just report where the game is

    string script;
    using (var s = typeof(Program).Assembly.GetManifestResourceStream("menu.js")!)
    using (var r = new StreamReader(s)) script = r.ReadToEnd();

    // --- pick a free localhost port ---
    var l = new TcpListener(IPAddress.Loopback, 0); l.Start();
    int port = ((IPEndPoint)l.LocalEndpoint).Port; l.Stop();

    var psi = new ProcessStartInfo(exe) { WorkingDirectory = Path.GetDirectoryName(exe)!, UseShellExecute = false };
    foreach (var a in passArgs) psi.ArgumentList.Add(a);
    var extra = Environment.GetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
    psi.Environment["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = $"{extra} --remote-debugging-port={port}".Trim();
    if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SteamAppId"))) psi.Environment["SteamAppId"] = "5101960";
    var proc = Process.Start(psi)!;
    Log($"started pid {proc.Id}, debug port {port}");

    // --- wait for the game page ---
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
    string? wsUrl = null;
    for (int i = 0; i < 240 && wsUrl == null && !proc.HasExited; i++)
    {
        try
        {
            var json = await http.GetStringAsync($"http://127.0.0.1:{port}/json");
            foreach (var t in JsonDocument.Parse(json).RootElement.EnumerateArray())
                if (t.GetProperty("type").GetString() == "page" &&
                    (t.GetProperty("url").GetString() ?? "").StartsWith("http://tauri.localhost"))
                { wsUrl = t.GetProperty("webSocketDebuggerUrl").GetString(); break; }
        }
        catch { }
        if (wsUrl == null) await Task.Delay(500);
    }
    if (wsUrl == null) { Log("game page never appeared"); return 2; }
    Log("page: " + wsUrl);

    // --- inject ---
    using var ws = new ClientWebSocket();
    await ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None);
    int id = 0;
    async Task Send(string method, object prms)
    {
        var msg = JsonSerializer.SerializeToUtf8Bytes(new { id = ++id, method, @params = prms });
        await ws.SendAsync(msg, WebSocketMessageType.Text, true, CancellationToken.None);
    }
    await Send("Page.enable", new { });
    await Send("Page.addScriptToEvaluateOnNewDocument", new { source = script }); // survives page reloads
    await Send("Runtime.evaluate", new { expression = script });                    // current page
    await Send("Runtime.enable", new { });                                          // watch for new JS contexts
    Log("menu injected");

    // Keep the session open. Whenever the page gets a fresh main-world context (reload),
    // inject again; menu.js guards against running twice.
    var listen = Task.Run(async () =>
    {
        var buf = new byte[1 << 20];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                using var ms = new MemoryStream();
                WebSocketReceiveResult r;
                do { r = await ws.ReceiveAsync(buf, CancellationToken.None); ms.Write(buf, 0, r.Count); } while (!r.EndOfMessage);
                if (r.MessageType == WebSocketMessageType.Close) break;
                using var doc = JsonDocument.Parse(ms.ToArray());
                var root = doc.RootElement;
                if (root.TryGetProperty("error", out var err)) Log("cdp error: " + err);
                if (root.TryGetProperty("method", out var m) && m.GetString() == "Runtime.executionContextCreated")
                {
                    var ctx = root.GetProperty("params").GetProperty("context");
                    if (ctx.TryGetProperty("auxData", out var aux) && aux.TryGetProperty("isDefault", out var def) && def.GetBoolean())
                    {
                        await Send("Runtime.evaluate", new { expression = script, contextId = ctx.GetProperty("id").GetInt32() });
                        Log("re-injected after reload");
                    }
                }
            }
        }
        catch (Exception e) { Log("listener stopped: " + e.Message); }
    });
    await proc.WaitForExitAsync();
    Log("game exited");
    return 0;
}
catch (Exception e)
{
    Log("error: " + e);
    return 3;
}

partial class Program { }
