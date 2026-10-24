using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("赛博拼豆 · 拼豆 App 启动器")]
[assembly: AssemblyDescription("无控制台启动器与仅本机使用的游戏服务")]
[assembly: AssemblyVersion("1.0.0.0")]

internal static class Launcher
{
    internal const string BaseUrl = "http://127.0.0.1:4173/";
    internal const string AppId = "bead-room-local-launcher-v1";
    internal static readonly string ExePath = Assembly.GetExecutingAssembly().Location;
    internal static readonly string Root = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(ExePath), "bead-room", "dist"));
    internal static readonly string UserId = WindowsIdentity.GetCurrent().User.Value;
    internal static readonly string StopName = "Local\\BeadRoom.Stop." + UserId;
    private static readonly object OpenGate = new object();
    private static DateTime lastOpened = DateTime.MinValue;

    [STAThread]
    private static int Main(string[] args)
    {
        bool serve = Array.IndexOf(args, "--serve") >= 0;
        bool ensureOnly = Array.IndexOf(args, "--ensure") >= 0;
        bool stop = Array.IndexOf(args, "--stop") >= 0;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try
        {
            if (stop)
            {
                EventWaitHandle signal;
                if (EventWaitHandle.TryOpenExisting(StopName, out signal))
                    using (signal) signal.Set();
                return 0;
            }
            if (serve) return RunServer();
            EnsureReady();
            if (!ensureOnly) OpenGame();
            return 0;
        }
        catch (Exception error)
        {
            Log(error.ToString());
            if (!serve && !ensureOnly)
                MessageBox.Show(error.Message + "\n\n请保留启动器与 bead-room 文件夹在同一目录。", "赛博拼豆 · 启动提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }

    private static void ValidateFiles()
    {
        foreach (string file in new[] { "index.html", "app.js", "craft-model.js", "bead-3d.js", "vendor/three.module.js", "vendor/three.core.js", "vendor/cannon-es.js" })
            if (!File.Exists(Path.Combine(Root, file.Replace('/', Path.DirectorySeparatorChar))))
                throw new IOException("没有找到完整的游戏文件：" + file + "。\n请完整解压后，让启动器与 bead-room 文件夹保持在一起再打开。");
    }

    private static void EnsureReady()
    {
        ValidateFiles();
        using (Mutex startup = new Mutex(false, "Local\\BeadRoom.Start." + UserId))
        {
            bool acquired;
            try { acquired = startup.WaitOne(20000); }
            catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) throw new IOException("游戏正在启动，请稍后再次打开启动器。");
            try
            {
                if (IsReady(true)) return;
                if (PortIsListening())
                    throw new IOException("游戏端口 4173 正被其他程序占用。\n请关闭占用该端口的程序，再打开启动器；不会改变你的游戏地址或收藏数据。");
                ProcessStartInfo info = new ProcessStartInfo(ExePath, "--serve");
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.WindowStyle = ProcessWindowStyle.Hidden;
                info.WorkingDirectory = Path.GetDirectoryName(ExePath);
                using (Process child = Process.Start(info))
                {
                    Stopwatch watch = Stopwatch.StartNew();
                    while (watch.ElapsedMilliseconds < 12000)
                    {
                        if (IsReady(false)) return;
                        if (child.HasExited) break;
                        Thread.Sleep(120);
                    }
                }
                throw new IOException("本地游戏服务未能启动。请再次打开启动器。\n启动日志位于：" + LogPath());
            }
            finally { startup.ReleaseMutex(); }
        }
    }

    private static bool IsReady(bool allowLegacy)
    {
        try
        {
            string health = ReadUrl(BaseUrl + "__bead_room_health__", 1000, 8192);
            Dictionary<string, object> data = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(health);
            if (data != null && data.ContainsKey("app") && data.ContainsKey("root") &&
                Convert.ToString(data["app"]) == AppId)
                return String.Equals(Convert.ToString(data["root"]), Root, StringComparison.OrdinalIgnoreCase);
        }
        catch { }
        if (allowLegacy)
        {
            try
            {
                // Migrate without killing an existing working Node service or changing the storage origin.
                return ReadUrl(BaseUrl, 1000, 1048576) == File.ReadAllText(Path.Combine(Root, "index.html"), Encoding.UTF8);
            }
            catch { }
        }
        return false;
    }

    private static string ReadUrl(string address, int timeout, int limit)
    {
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(address);
        request.Proxy = null;
        request.Timeout = timeout;
        request.ReadWriteTimeout = timeout;
        request.AllowAutoRedirect = false;
        request.KeepAlive = false;
        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
        using (Stream stream = response.GetResponseStream())
        using (MemoryStream result = new MemoryStream())
        {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.Read(buffer, 0, buffer.Length)) > 0)
            {
                if (result.Length + count > limit) throw new IOException("Unexpected response size");
                result.Write(buffer, 0, count);
            }
            return Encoding.UTF8.GetString(result.ToArray());
        }
    }

    private static bool PortIsListening()
    {
        using (TcpClient client = new TcpClient())
        {
            try
            {
                IAsyncResult result = client.BeginConnect(IPAddress.Loopback, 4173, null, null);
                using (result.AsyncWaitHandle)
                {
                    if (!result.AsyncWaitHandle.WaitOne(400)) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch { return false; }
        }
    }

    internal static void OpenGame()
    {
        lock (OpenGate)
        {
            if ((DateTime.UtcNow - lastOpened).TotalMilliseconds < 750) return;
            ProcessStartInfo browser = new ProcessStartInfo(BaseUrl + "#studio");
            browser.UseShellExecute = true;
            Process.Start(browser);
            lastOpened = DateTime.UtcNow;
        }
    }

    private static int RunServer()
    {
        ValidateFiles();
        using (Mutex running = new Mutex(false, "Local\\BeadRoom.Server." + UserId))
        {
            bool acquired;
            try { acquired = running.WaitOne(0); }
            catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) return 0;
            try
            {
                using (LocalServer server = new LocalServer(Root))
                using (ServerContext context = new ServerContext(server))
                    Application.Run(context);
                return 0;
            }
            finally { running.ReleaseMutex(); }
        }
    }

    private static string LogPath()
    {
        return Path.Combine(Path.GetTempPath(), "bead-room-launcher.log");
    }

    internal static void Log(string message)
    {
        try
        {
            string path = LogPath();
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            if (File.Exists(path) && new FileInfo(path).Length > 524288) File.WriteAllText(path, "", Encoding.UTF8);
            File.AppendAllText(path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine, Encoding.UTF8);
        }
        catch { }
    }
}

internal sealed class ServerContext : ApplicationContext
{
    private readonly NotifyIcon tray;
    private readonly System.Windows.Forms.Timer stopTimer;
    private readonly EventWaitHandle stop;
    private readonly LocalServer server;

    internal ServerContext(LocalServer value)
    {
        server = value;
        stop = new EventWaitHandle(false, EventResetMode.ManualReset, Launcher.StopName);
        stop.Reset();
        tray = new NotifyIcon();
        tray.Icon = Icon.ExtractAssociatedIcon(Launcher.ExePath) ?? SystemIcons.Application;
        tray.Text = "赛博拼豆 · 拼豆游戏（正在运行）";
        ContextMenuStrip menu = new ContextMenuStrip();
        menu.Items.Add("打开拼豆游戏", null, delegate { TryOpen(); });
        menu.Items.Add("退出后台服务", null, delegate { ExitThread(); });
        tray.ContextMenuStrip = menu;
        tray.DoubleClick += delegate { TryOpen(); };
        tray.Visible = true;
        stopTimer = new System.Windows.Forms.Timer();
        stopTimer.Interval = 200;
        stopTimer.Tick += delegate { if (stop.WaitOne(0)) ExitThread(); };
        stopTimer.Start();
    }

    private void TryOpen()
    {
        try { Launcher.OpenGame(); }
        catch (Exception error) { Launcher.Log(error.ToString()); MessageBox.Show("浏览器未能自动打开，请访问：" + Launcher.BaseUrl, "赛博拼豆"); }
    }

    protected override void ExitThreadCore()
    {
        stopTimer.Stop();
        server.Dispose();
        tray.Visible = false;
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { stopTimer.Dispose(); tray.Dispose(); stop.Dispose(); }
        base.Dispose(disposing);
    }
}

internal sealed class LocalServer : IDisposable
{
    private readonly TcpListener listener;
    private readonly string root;
    private volatile bool alive = true;
    private int clients;
    private static readonly Encoding Utf8 = new UTF8Encoding(false);

    internal LocalServer(string directory)
    {
        root = directory.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        listener = new TcpListener(IPAddress.Loopback, 4173);
        listener.ExclusiveAddressUse = true;
        listener.Start(64);
        Thread accept = new Thread(Accept);
        accept.IsBackground = true;
        accept.Start();
    }

    private void Accept()
    {
        while (alive)
        {
            try
            {
                TcpClient client = listener.AcceptTcpClient();
                if (Interlocked.Increment(ref clients) > 64) { client.Close(); Interlocked.Decrement(ref clients); continue; }
                ThreadPool.QueueUserWorkItem(delegate
                {
                    try { Handle(client); }
                    catch (IOException) { }
                    catch (SocketException) { }
                    catch (Exception error) { Launcher.Log(error.ToString()); }
                    finally { client.Close(); Interlocked.Decrement(ref clients); }
                });
            }
            catch (SocketException) { if (alive) Thread.Sleep(100); }
            catch (ObjectDisposedException) { return; }
        }
    }

    private void Handle(TcpClient client)
    {
        client.ReceiveTimeout = 4000;
        client.SendTimeout = 10000;
        client.NoDelay = true;
        using (NetworkStream stream = client.GetStream())
        {
            stream.ReadTimeout = 4000;
            stream.WriteTimeout = 10000;
            StringBuilder header = new StringBuilder();
            Stopwatch headerWatch = Stopwatch.StartNew();
            int value;
            while (true)
            {
                long remaining = 5000 - headerWatch.ElapsedMilliseconds;
                if (remaining <= 0) { Text(stream, 408, "Request Timeout", false); return; }
                stream.ReadTimeout = (int)Math.Min(4000, remaining);
                value = stream.ReadByte();
                if (value < 0) return;
                header.Append((char)value);
                if (header.Length > 16384) { Text(stream, 431, "Request Header Fields Too Large", false); return; }
                int n = header.Length;
                if (n >= 4 && header[n - 4] == '\r' && header[n - 3] == '\n' && header[n - 2] == '\r' && header[n - 1] == '\n') break;
            }
            string first = header.ToString().Split(new[] { "\r\n" }, StringSplitOptions.None)[0];
            string[] parts = first.Split(' ');
            if (parts.Length != 3 || !parts[2].StartsWith("HTTP/1.")) { Text(stream, 400, "Bad Request", false); return; }
            bool head = parts[0] == "HEAD";
            if (!head && parts[0] != "GET") { Text(stream, 405, "Method Not Allowed", false); return; }
            string path;
            try { path = Uri.UnescapeDataString(parts[1].Split('?')[0]); }
            catch { Text(stream, 400, "Bad Request", head); return; }
            if (!path.StartsWith("/") || path.IndexOfAny(new[] { '\0', ':', '\\' }) >= 0) { Text(stream, 403, "Forbidden", head); return; }
            if (path == "/__bead_room_health__")
            {
                string data = new JavaScriptSerializer().Serialize(new Dictionary<string, object> {
                    { "app", Launcher.AppId }, { "root", Launcher.Root }, { "pid", Process.GetCurrentProcess().Id }, { "version", 1 }
                });
                Reply(stream, 200, "OK", "application/json; charset=utf-8", Utf8.GetBytes(data), head);
                return;
            }
            string filename;
            try { filename = Path.GetFullPath(Path.Combine(root, path == "/" ? "index.html" : path.Substring(1).Replace('/', Path.DirectorySeparatorChar))); }
            catch { Text(stream, 400, "Bad Request", head); return; }
            if (!filename.StartsWith(root, StringComparison.OrdinalIgnoreCase)) { Text(stream, 403, "Forbidden", head); return; }
            // Serve game assets only; launcher sources and other workspace files stay outside this root.
            if (!File.Exists(filename)) { Text(stream, 404, "Not Found", head); return; }
            try
            {
                using (FileStream file = new FileStream(filename, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                {
                    WriteHeader(stream, 200, "OK", Mime(Path.GetExtension(filename)), file.Length);
                    if (!head) file.CopyTo(stream);
                }
            }
            catch (FileNotFoundException) { Text(stream, 404, "Not Found", head); }
            catch (UnauthorizedAccessException) { Text(stream, 403, "Forbidden", head); }
        }
    }

    private static string Mime(string extension)
    {
        switch (extension.ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": case ".mjs": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".svg": return "image/svg+xml";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".webp": return "image/webp";
            case ".ico": return "image/x-icon";
            case ".woff": return "font/woff";
            case ".woff2": return "font/woff2";
            case ".txt": case ".license": return "text/plain; charset=utf-8";
            case ".wasm": return "application/wasm";
            default: return "application/octet-stream";
        }
    }

    private static void Text(Stream stream, int status, string message, bool head)
    { Reply(stream, status, message, "text/plain; charset=utf-8", Utf8.GetBytes(message), head); }

    private static void Reply(Stream stream, int status, string message, string mime, byte[] body, bool head)
    { WriteHeader(stream, status, message, mime, body.Length); if (!head) stream.Write(body, 0, body.Length); }

    private static void WriteHeader(Stream stream, int status, string message, string mime, long length)
    {
        byte[] bytes = Encoding.ASCII.GetBytes("HTTP/1.1 " + status + " " + message + "\r\nContent-Type: " + mime + "\r\nContent-Length: " + length + "\r\nCache-Control: no-cache\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n");
        stream.Write(bytes, 0, bytes.Length);
    }

    public void Dispose()
    {
        if (!alive) return;
        alive = false;
        listener.Stop();
    }
}

