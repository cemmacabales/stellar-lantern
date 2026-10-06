package com.lantern.wallet;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // A dApp in the Apps tab is framed from another site (Lantern is
        // https://localhost), so its session cookie is a third-party cookie.
        // WebView drops those by default, which signs every dApp out on each
        // request. Cookies stay per-site: a dApp still can't read Lantern's.
        CookieManager.getInstance().setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }
}
