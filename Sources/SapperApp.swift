import AVFoundation
import SwiftUI
import WebKit

/// Native shell: the whole game is `web/index.html`, bundled and loaded from disk, so it runs fully offline.
@main
struct SapperApp: App {
    init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient)
    }

    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .background(Color.black)
        }
    }
}

struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Haptics { Haptics() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "haptic")
        config.userContentController.add(context.coordinator, name: "share")

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// Receives `haptic` and `share` messages from the game.
final class Haptics: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "share", let body = message.body as? [String: Any] {
            presentShare(body)
            return
        }
        switch message.body as? String {
        case "light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "heavy": UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
        default: break
        }
    }

    /// Shows the iOS share sheet with the score card image and text (Signal, WhatsApp, Messages...).
    private func presentShare(_ body: [String: Any]) {
        var items: [Any] = []
        if let dataURL = body["image"] as? String,
           let comma = dataURL.firstIndex(of: ","),
           let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) {
            if dataURL.hasPrefix("data:image/gif") {
                // share animated GIFs as a file so they stay animated
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("sapper-score.gif")
                if (try? data.write(to: url)) != nil { items.append(url) }
            } else if let image = UIImage(data: data) {
                items.append(image)
            }
        }
        if let text = body["text"] as? String { items.append(text) }
        guard !items.isEmpty,
              let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = scene.keyWindow?.rootViewController else { return }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = root.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.maxY - 80, width: 1, height: 1)
        (root.presentedViewController ?? root).present(sheet, animated: true)
    }
}

