import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";

export interface WeChatProfile extends Record<string, any> {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
}

type WeChatTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  openid: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

export default function WeChat<P extends WeChatProfile>(
  options: OAuthUserConfig<P>
): OAuthConfig<P> {
  return {
    id: "wechat",
    name: "WeChat",
    type: "oauth",
    authorization: {
      url: "https://open.weixin.qq.com/connect/qrconnect",
      params: {
        scope: "snsapi_login",
      },
    },
    token: {
      async request(context) {
        const code = context.params.code;
        if (!code) throw new Error("Missing WeChat OAuth code");

        const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
        url.searchParams.set("appid", context.provider.clientId as string);
        url.searchParams.set("secret", context.provider.clientSecret as string);
        url.searchParams.set("code", String(code));
        url.searchParams.set("grant_type", "authorization_code");

        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });
        const json = (await res.json()) as WeChatTokenResponse;
        if (!res.ok || json.errcode) {
          throw new Error(
            `WeChat token error: ${json.errcode ?? res.status} ${json.errmsg ?? ""}`.trim()
          );
        }

        const expiresAt =
          typeof json.expires_in === "number"
            ? Math.floor(Date.now() / 1000) + json.expires_in
            : undefined;

        return {
          tokens: {
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            expires_at: expiresAt,
            openid: json.openid,
            scope: json.scope,
            unionid: json.unionid,
          } as any,
        };
      },
    },
    userinfo: {
      async request(context) {
        const accessToken = context.tokens.access_token;
        const openid = (context.tokens as any).openid;
        if (!accessToken || !openid) {
          throw new Error("Missing WeChat access token/openid");
        }
        const url = new URL("https://api.weixin.qq.com/sns/userinfo");
        url.searchParams.set("access_token", String(accessToken));
        url.searchParams.set("openid", String(openid));
        url.searchParams.set("lang", "zh_CN");

        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("WeChat userinfo request failed");
        return (await res.json()) as any;
      },
    },
    profile(profile) {
      return {
        id: profile.unionid ?? profile.openid,
        name: profile.nickname ?? "WeChat",
        email: null,
        image: profile.headimgurl ?? null,
      };
    },
    style: { logo: "/brand/colorisvoid.png", bg: "#ffffff", text: "#111111" },
    options,
  };
}

