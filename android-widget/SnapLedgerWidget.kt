package com.snapledger.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import android.graphics.BitmapFactory
import java.io.File

/**
 * SnapLedger Android Home Screen Widget Provider
 */
class SnapLedgerWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.snapledger_widget_layout)

            // Read shared data written by React Native (using SharedPreferences)
            // React Native can write to Default SharedPreferences using libraries like react-native-default-preference
            val prefs = context.getSharedPreferences("SnapLedgerPrefs", Context.MODE_PRIVATE)
            val sender = prefs.getString("latestPostSender", "Ai đó")
            val caption = prefs.getString("latestPostCaption", "Không có mô tả")
            val cachedImagePath = prefs.getString("latestPostImagePath", null)

            views.setTextViewText(R.id.widget_sender_name, sender)
            views.setTextViewText(R.id.widget_caption, caption)

            // Render cached picture if exists
            if (cachedImagePath != null) {
                val imgFile = File(cachedImagePath)
                if (imgFile.exists()) {
                    val bitmap = BitmapFactory.decodeFile(imgFile.absolutePath)
                    views.setImageViewBitmap(R.id.widget_image, bitmap)
                }
            } else {
                views.setImageViewResource(R.id.widget_image, R.drawable.widget_placeholder_gradient)
            }

            // Instruct widget manager to update
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
