package top.goldierill.whitenote;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.core.splashscreen.SplashScreen;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 站点品牌深色（--primary 近似值），下拉刷新指示器颜色 */
    private static final int BRAND_DARK = 0xFF1C1C21;

    /** 开屏最长保留时间：网络不好时放行到白底页面，不能永远停在开屏 */
    private static final long SPLASH_TIMEOUT_MS = 15000;

    private volatile boolean contentReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 必须在 super.onCreate 之前安装，开屏才能延续到 WebView 首帧绘制完成
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // 开屏 logo 一直显示，直到远端站点加载完成（或超时兜底）
        splashScreen.setKeepOnScreenCondition(() -> !contentReady);
        final long startedAt = System.currentTimeMillis();

        WebView webView = getBridge().getWebView();
        // 站点是白底；避免开屏收起与页面绘制之间闪过黑屏
        webView.setBackgroundColor(Color.WHITE);

        // 下拉刷新：用 SwipeRefreshLayout 包住 WebView，松手后 reload 当前页
        // （主页 reload 即重新拉取帖子列表，应对手机息屏后网络不稳的情况）
        SwipeRefreshLayout swipe = new SwipeRefreshLayout(this);
        swipe.setColorSchemeColors(BRAND_DARK);
        ViewGroup parent = (ViewGroup) webView.getParent();
        parent.removeView(webView);
        parent.addView(swipe, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        swipe.addView(webView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        swipe.setOnRefreshListener(() -> {
            webView.reload();
            // 站点自身加载过程可见，转圈立即收起即可
            swipe.setRefreshing(false);
        });
        // 仅当页面滚动到顶部时允许下拉触发，避免与页面内部滚动打架
        webView.getViewTreeObserver().addOnScrollChangedListener(() ->
                swipe.setEnabled(webView.getScrollY() == 0));

        // WebView 进度到 100（或超时）后放行首帧
        Handler handler = new Handler(Looper.getMainLooper());
        final Runnable checkLoaded = new Runnable() {
            @Override
            public void run() {
                boolean loaded = webView.getProgress() >= 100;
                boolean timedOut = System.currentTimeMillis() - startedAt >= SPLASH_TIMEOUT_MS;
                if (loaded || timedOut) {
                    contentReady = true;
                } else {
                    handler.postDelayed(this, 100);
                }
            }
        };
        handler.postDelayed(checkLoaded, 100);
    }
}
