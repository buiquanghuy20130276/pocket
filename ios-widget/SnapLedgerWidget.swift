import WidgetKit
import SwiftUI

struct WidgetEntry: TimelineEntry {
    let date: Date
    let senderName: String
    let caption: String?
    let photoData: Data?
}

struct WidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), senderName: "Huy Quang", caption: "Ăn tối phở cuốn 50k", photoData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let entry = WidgetEntry(date: Date(), senderName: "Huy Quang", caption: "Ăn tối phở cuốn 50k", photoData: nil)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let sharedDefaults = UserDefaults(suiteName: "group.com.snapledger.app")
        let cachedData = sharedDefaults?.data(forKey: "latestPostPhotoData")
        let senderName = sharedDefaults?.string(forKey: "latestPostSender") ?? "Ai đó"
        let caption = sharedDefaults?.string(forKey: "latestPostCaption")

        let entry = WidgetEntry(
            date: Date(),
            senderName: senderName,
            caption: caption,
            photoData: cachedData
        )

        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct SnapLedgerWidgetView: View {
    var entry: WidgetProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let data = entry.photoData, let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                LinearGradient(colors: [Color.orange, Color.red], startPoint: .topLeading, endPoint: .bottomTrailing)
            }

            LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .center, endPoint: .bottom)

            VStack(alignment: .leading, spacing: 4) {
                Spacer()
                if family == .systemSmall {
                    Text(entry.senderName)
                        .font(.caption2.bold())
                        .foregroundColor(.white)
                        .padding(6)
                        .background(Color.black.opacity(0.4))
                        .cornerRadius(6)
                        .padding(8)
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.senderName)
                            .font(.caption.bold())
                            .foregroundColor(.white)
                        if let caption = entry.caption {
                            Text(caption)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.9))
                                .lineLimit(2)
                        }
                    }
                    .padding(12)
                }
            }
        }
        .containerBackground(for: .widget) { Color.black }
    }
}

@main
struct SnapLedgerWidget: Widget {
    let kind: String = "SnapLedgerWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetProvider()) { entry in
            SnapLedgerWidgetView(entry: entry)
        }
        .configurationDisplayName("SnapLedger Locket")
        .description("Xem khoảnh khắc và chi tiêu mới nhất của bạn bè trên Home Screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
