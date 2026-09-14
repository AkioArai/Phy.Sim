package ru.physim.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Единственный экран приложения: WebView на весь экран, в нём — то же самое
 * пособие, что и в браузере. Никакой отдельной «мобильной» логики здесь нет:
 * вёрстка и так подстраивается под телефон (data-ui="mobile").
 */
public class MainActivity extends Activity {

  private WebView web;
  /** Ждём ответа JS про кнопку «назад»; пока ждём — второе нажатие не обрабатываем. */
  private boolean backPending = false;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle saved) {
    super.onCreate(saved);

    // Тёмный фон под WebView: при повороте и при подтягивании страницы
    // белая вспышка на тёмной теме бросается в глаза сильнее всего.
    getWindow().getDecorView().setBackgroundColor(Color.parseColor("#101318"));

    web = new WebView(this);
    web.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    web.setBackgroundColor(Color.parseColor("#101318"));
    // Полосы прокрутки поверх сцены только мешают: страница сама не скроллится.
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    web.setVerticalScrollBarEnabled(false);
    web.setHorizontalScrollBarEnabled(false);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);        // localStorage: закладки, прогресс задач, настройки
    s.setAllowFileAccess(true);          // пособие лежит в assets и открывается по file://
    s.setBuiltInZoomControls(false);     // масштаб у сцены свой, системный только мешает
    s.setDisplayZoomControls(false);
    s.setSupportZoom(false);
    s.setLoadWithOverviewMode(false);
    s.setUseWideViewPort(false);         // viewport берём из <meta>, а не «как на десктопе»
    s.setMediaPlaybackRequiresUserGesture(false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      // Ничего внешнего не грузим, но правило ставим строгое явно.
      s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    }

    // Никаких переходов наружу: всё, что не наш file://, просто игнорируем.
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
        return !url.startsWith("file:///android_asset/");
      }
    });

    // Мост для сохранения файлов. Без него WebView не скачивает ничего:
    // ни blob:, ни data: — ссылка с download просто молчит, и в приложении
    // «не работали» ни компиляция графика, ни снимок кадра, ни выгрузка.
    web.addJavascriptInterface(new Saver(), "PhySim");

    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");
  }

  /**
   * Кнопка «назад». Сначала спрашиваем страницу: есть ли что закрыть
   * (шторка параметров, ящик тем, попап, командная палитра). Если нечего —
   * выходим. Иначе выход из приложения посреди работы выглядел бы поломкой.
   */
  @Override
  public void onBackPressed() {
    if (web == null || backPending) return;
    backPending = true;
    web.evaluateJavascript(
        "(function(){try{return window.physimBack&&physimBack()?1:0}catch(e){return 0}})()",
        new ValueCallback<String>() {
          @Override public void onReceiveValue(String value) {
            backPending = false;
            if (!"1".equals(value)) finish();
          }
        });
  }

  /**
   * Сохранение файла из страницы. Страница отдаёт содержимое в base64,
   * здесь оно пишется на диск и возвращается путь — его показывают человеку.
   *
   * Разрешений не просим и не добавляем: на Android 10 и новее запись в
   * общие «Загрузки» идёт через MediaStore и разрешения не требует, а на
   * более старых пишем в собственную папку приложения на внешней памяти —
   * туда тоже можно без разрешений. Ноль разрешений у пакета — обещание,
   * которое дороже удобства пути.
   */
  public class Saver {
    @JavascriptInterface
    public String saveFile(String name, String mime, String base64) {
      if (name == null || base64 == null) return null;
      name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
      byte[] data;
      try { data = Base64.decode(base64, Base64.DEFAULT); }
      catch (Exception e) { return null; }
      try {
        if (Build.VERSION.SDK_INT >= 29) {
          ContentValues v = new ContentValues();
          v.put(MediaStore.Downloads.DISPLAY_NAME, name);
          if (mime != null && mime.length() > 0) v.put(MediaStore.Downloads.MIME_TYPE, mime);
          v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
          v.put(MediaStore.Downloads.IS_PENDING, 1);
          Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
          if (item == null) return null;
          OutputStream out = getContentResolver().openOutputStream(item);
          if (out == null) return null;
          out.write(data); out.close();
          v.clear(); v.put(MediaStore.Downloads.IS_PENDING, 0);
          getContentResolver().update(item, v, null, null);
          return "Загрузки/" + name;
        }
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) return null;
        if (!dir.exists() && !dir.mkdirs()) return null;
        File f = new File(dir, name);
        FileOutputStream out = new FileOutputStream(f);
        out.write(data); out.close();
        return f.getAbsolutePath();
      } catch (Exception e) {
        return null;
      }
    }
  }

  /** Аппаратная клавиатура/геймпад: те же клавиши, что и в браузере. */
  @Override
  public boolean onKeyDown(int code, KeyEvent ev) {
    return super.onKeyDown(code, ev);
  }

  @Override protected void onPause()  { super.onPause();  if (web != null) web.onPause(); }
  @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

  @Override
  protected void onDestroy() {
    if (web != null) { web.destroy(); web = null; }
    super.onDestroy();
  }
}
