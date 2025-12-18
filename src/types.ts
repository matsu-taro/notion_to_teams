export interface Env {
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID_DEV: string;
  NOTION_DATABASE_ID_INFRA: string;
  NOTION_DATABASE_ID_OTHER: string;
  TEAMS_WEBHOOK_URL: string;
}

export interface NotionPage {
  id: string;
  created_time: string;
  properties: {
    名前?: {
      title: Array<{ text: { content: string } }>;
    }
  };
  url: string;
  database?: string; // データベース名（開発/インフラ/その他）
}

export interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}
