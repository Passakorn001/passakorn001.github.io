const BASE_URL = "https://open.larksuite.com/open-apis";

export class LarkClient {
  constructor({ appId, appSecret }) {
    if (!appId || !appSecret) {
      throw new Error("Missing LARK_APP_ID or LARK_APP_SECRET.");
    }

    this.appId = appId;
    this.appSecret = appSecret;
    this.tenantAccessToken = null;
  }

  async getTenantAccessToken() {
    if (this.tenantAccessToken) return this.tenantAccessToken;

    const response = await fetch(`${BASE_URL}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    const data = await readJson(response);
    if (data.code !== 0) {
      throw new Error(`Failed to get tenant access token: ${JSON.stringify(data)}`);
    }

    this.tenantAccessToken = data.tenant_access_token;
    return this.tenantAccessToken;
  }

  async request(path, { method = "GET", query, body } = {}) {
    const token = await this.getTenantAccessToken();
    const url = new URL(`${BASE_URL}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value == null || value === "") continue;
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(key, item);
        } else if (typeof value === "object") {
          url.searchParams.set(key, JSON.stringify(value));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8"
      },
      body: body == null ? undefined : JSON.stringify(body)
    });

    const data = await readJson(response);
    if (!response.ok || data.code !== 0) {
      throw new Error(`${method} ${path} failed: ${JSON.stringify(data)}`);
    }

    return data;
  }

  async listBitableRecords({ appToken, tableId, viewId, fieldNames, filter, pageSize = 100 }) {
    const all = [];
    let pageToken;

    do {
      const data = await this.request(
        `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`,
        {
          query: {
            page_size: pageSize,
            page_token: pageToken,
            view_id: viewId,
            field_names: fieldNames,
            filter
          }
        }
      );

      all.push(...(data.data?.items ?? []));
      pageToken = data.data?.page_token;
    } while (pageToken);

    return all;
  }

  async createBitableRecord({ appToken, tableId, fields }) {
    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`,
      {
        method: "POST",
        body: { fields }
      }
    );
  }

  async updateBitableRecord({ appToken, tableId, recordId, fields }) {
    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
      {
        method: "PUT",
        body: { fields }
      }
    );
  }

  async batchDeleteBitableRecords({ appToken, tableId, recordIds }) {
    if (!Array.isArray(recordIds)) {
      throw new Error("recordIds must be an array.");
    }

    return this.request(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_delete`,
      {
        method: "POST",
        body: { records: recordIds }
      }
    );
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 500)}`);
  }
}
