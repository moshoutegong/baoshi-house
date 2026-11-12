// 宝石小屋 —— iOS 原生外壳
// 游戏的全部文件（网页、3D 引擎、题库）都打包在 App 里的 www 文件夹中，
// 通过自定义的 app:// 地址从本机读取，不访问网络，第一次打开就能离线玩。
import SwiftUI
import WebKit

@main
struct BaoshiApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBar(hidden: true)
        }
    }
}

/// 把 app://localhost/xxx 的请求对应到 App 包里 www/xxx 这个文件
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.bundleURL.appendingPathComponent("www").standardizedFileURL
    private let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8", "json": "application/json; charset=utf-8",
        "png": "image/png", "jpg": "image/jpeg", "webp": "image/webp", "svg": "image/svg+xml",
        "mp3": "audio/mpeg", "m4a": "audio/mp4", "woff2": "font/woff2"
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
            return
        }
        let mime = mimeTypes[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)"])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// 游戏每次存档时，同时在系统的偏好设置里再存一份，作为备份
final class SaveBridge: NSObject, WKScriptMessageHandler {
    static let key = "baoshi-house-save"
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if let text = message.body as? String { UserDefaults.standard.set(text, forKey: SaveBridge.key) }
    }
}

struct GameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "app")
        config.userContentController.add(SaveBridge(), name: "save")
        config.allowsInlineMediaPlayback = true

        // 启动时把备份的存档交给网页，网页会和自己的存档比较，用较新的那一份
        if let saved = UserDefaults.standard.string(forKey: SaveBridge.key),
           let encoded = try? JSONEncoder().encode(saved),
           let literal = String(data: encoded, encoding: .utf8) {
            let script = WKUserScript(source: "window.__nativeSave = \(literal);",
                                      injectionTime: .atDocumentStart, forMainFrameOnly: true)
            config.userContentController.addUserScript(script)
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.14, green: 0.37, blue: 0.45, alpha: 1)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.allowsLinkPreview = false
        webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
