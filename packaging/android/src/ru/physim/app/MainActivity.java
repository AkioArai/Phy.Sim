package ru.physim.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
