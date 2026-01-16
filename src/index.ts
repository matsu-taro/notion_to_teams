import type { Env, NotionPage, NotionQueryResponse } from './types';

/**
 * 先週の月曜日0:00と日曜日23:59のタイムスタンプを取得
 */
function getLastWeekRange(): { start: string; end: string } {
  const now = new Date();

  // 今日の曜日 (0=日曜, 1=月曜, ..., 6=土曜)
  const today = now.getDay();

  // 先週の月曜日までの日数を計算
  // 今日が月曜日(1)なら7日前、火曜日(2)なら8日前...日曜日(0)なら6日前
  const daysToLastMonday = today === 0 ? 6 : today + 6;

  // 先週の月曜日 0:00
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);

  // 先週の日曜日 23:59:59
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  return {
    start: lastMonday.toISOString(),
    end: lastSunday.toISOString(),
  };
}

/**
 * 単一のデータベースから先週の記事を取得
 */
async function fetchFromDatabase(
  env: Env,
  databaseId: string,
  start: string,
  end: string
): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: any = {
      filter: {
        and: [
          {
            timestamp: "created_time",
            created_time: {
              on_or_after: start,
            },
          },
          {
            timestamp: "created_time",
            created_time: {
              on_or_before: end,
            },
          },
        ],
      },
      page_size: 100,
    };

    if (startCursor) {
      body.start_cursor = startCursor;
    }

    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Notion API error for DB ${databaseId}: ${response.status} ${errorText}`);
    }

    const data: NotionQueryResponse = await response.json();
    allPages.push(...data.results);

    hasMore = data.has_more;
    startCursor = data.next_cursor ?? undefined;
  }

  return allPages;
}

/**
 * 全データベースから先週の記事を取得
 */
async function fetchNotionPages(env: Env): Promise<NotionPage[]> {
  const { start, end } = getLastWeekRange();

  // 3つのデータベースから並列で記事を取得（エラーハンドリング付き）
  const databases = [
    { id: env.NOTION_DATABASE_ID_DEV, name: "開発DB", label: "開発" },
    { id: env.NOTION_DATABASE_ID_INFRA, name: "インフラDB", label: "インフラ" },
    { id: env.NOTION_DATABASE_ID_OTHER, name: "その他DB", label: "その他" },
  ];

  const results = await Promise.allSettled(
    databases.map(db => fetchFromDatabase(env, db.id, start, end))
  );

  const allPages: NotionPage[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      // 各記事にデータベース名を付与
      const pagesWithDatabase = result.value.map(page => ({
        ...page,
        database: databases[index].label,
      }));
      allPages.push(...pagesWithDatabase);
      console.log(`${databases[index].name}: ${result.value.length}件取得`);
    } else {
      console.error(`${databases[index].name}の取得に失敗:`, result.reason);
    }
  });

  // データベース別（開発→インフラ→その他）、各DB内では作成日時順にソート
  const dbOrder = { "開発": 1, "インフラ": 2, "その他": 3 };

  allPages.sort((a, b) => {
    // データベースの順番で比較
    const dbA = dbOrder[a.database as keyof typeof dbOrder] || 999;
    const dbB = dbOrder[b.database as keyof typeof dbOrder] || 999;

    if (dbA !== dbB) {
      return dbA - dbB;
    }

    // 同じデータベース内では作成日時順
    return new Date(a.created_time).getTime() - new Date(b.created_time).getTime();
  });

  return allPages;
}

/**
 * NotionページからタイトルとURLを抽出
 */
function extractPageInfo(page: NotionPage): { title: string; url: string } {
  const title = page.properties.名前?.title?.[0]?.text?.content || "無題";
  const url = page.url;

  return { title, url };
}

/**
 * Teams Webhookにメッセージを送信
 */
async function sendToTeams(env: Env, pages: NotionPage[]): Promise<void> {
  const { start, end } = getLastWeekRange();
  const startDate = new Date(start).toLocaleDateString("ja-JP");
  const endDate = new Date(end).toLocaleDateString("ja-JP");

  // タイトルカードを作成
  const titleCard = {
    contentType: "application/vnd.microsoft.card.adaptive",
    content: {
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "TextBlock",
          text: `💡 先週のNotion記事 (${startDate} - ${endDate})`,
          size: "Large",
          weight: "Bolder",
          wrap: true
        },
        {
          type: "TextBlock",
          text: `先週は ${pages.length}件 の記事を登録！🎉`,
          size: "Medium",
          wrap: true,
          spacing: "Small"
        }
      ]
    }
  };

  // 記事カードを作成
  const articleCards = pages.map((page, index) => {
    const info = extractPageInfo(page);
    const dbLabel = page.database ? `🎈【${page.database}】` : "";

    return {
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "Container",
            padding: "None",
            items: [
              {
                type: "TextBlock",
                text: dbLabel,
                size: "Medium",
                weight: "Bolder",
                color: "Warning",
                spacing: "None"
              },
              {
                type: "TextBlock",
                text: `${index + 1}. ${info.title}`,
                weight: "Bolder",
                size: "Medium",
                wrap: true,
                spacing: "None"
              }
            ]
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "☀️ Notionで開く",
            url: info.url
          }
        ]
      }
    };
  });

  // タイトルカードを最初に、その後記事カードを追加
  const attachments = [titleCard, ...articleCards];

  // Power Automate Adaptive Card対応形式
  const message = {
    attachments: attachments,
  };

  console.log("Sending to Teams:", JSON.stringify(message, null, 2));

  const response = await fetch(env.TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  const responseText = await response.text();
  console.log("Teams response status:", response.status);
  console.log("Teams response body:", responseText);

  if (!response.ok && response.status !== 202) {
    throw new Error(`Teams Webhook error: ${response.status} ${responseText}`);
  }
}

/**
 * Cloudflare Workers Scheduled Event Handler
 */
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    try {
      // Notionから先週の記事を取得
      const pages = await fetchNotionPages(env);
      console.log(`Found ${pages.length} pages from last week`);

      // Teamsに通知
      await sendToTeams(env, pages);
      console.log("Successfully sent notification to Teams");
    } catch (error) {
      console.error("Error in scheduled task:", error);
      throw error;
    }
  },

  // 手動テスト用のHTTPエンドポイント「/test」に送信
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/test") {
      try {
        const pages = await fetchNotionPages(env);
        await sendToTeams(env, pages);
  
        return new Response(
          JSON.stringify({ success: true, pageCount: pages.length }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  
    return new Response("Not Found", { status: 404 });
  },
};
