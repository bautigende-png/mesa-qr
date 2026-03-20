import type { EventRecord, Profile, RestaurantTable, Settings } from "@/lib/types";

type DemoStore = {
  tables: RestaurantTable[];
  waiters: Profile[];
  settings: Settings;
  events: EventRecord[];
};

declare global {
  var __mesaListaDemoStore: DemoStore | undefined;
}

function seedStore(): DemoStore {
  const now = Date.now();

  return {
    settings: {
      id: 1,
      restaurant_name: "Bistro Central Demo",
      global_menu_url: "https://example.com/menu",
      direct_order_url: "https://example.com/pedi-directo",
      logo_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80",
      mobile_banner_url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      mobile_banner_text: "2x1 en vermú hasta las 20 hs",
      custom_message: "Hoy recomendamos compartir una milanesa napolitana y cerrar con flan casero.",
      brand_primary_color: "#0f172a",
      brand_secondary_color: "#b45309",
      brand_tertiary_color: "#f8f5ef",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString()
    },
    tables: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        table_name: "Mesa 1",
        active: true,
        sector: "Salon",
        ordering_url: "https://example.com/menu/mesa-1",
        menu_url_override: null,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        table_name: "Mesa 7",
        active: true,
        sector: "Ventana",
        ordering_url: "https://example.com/menu/mesa-7",
        menu_url_override: null,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      }
    ],
    waiters: [
      {
        id: "11111111-1111-1111-1111-111111111110",
        email: "mozo@demo.local",
        full_name: "Mozo Demo",
        role: "WAITER",
        created_at: new Date(now).toISOString()
      }
    ],
    events: [
      {
        id: "11111111-1111-1111-1111-111111111112",
        table_id: "22222222-2222-2222-2222-222222222222",
        action: "CALL_WAITER",
        status: "PENDING",
        customer_email: "cliente@demo.com",
        marketing_opt_in: true,
        session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        created_at: new Date(now - 8 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 8 * 60 * 1000).toISOString(),
        acknowledged_at: null,
        resolved_at: null,
        restaurant_tables: {
          id: "22222222-2222-2222-2222-222222222222",
          table_name: "Mesa 7",
          sector: "Ventana"
        }
      },
      {
        id: "11111111-1111-1111-1111-111111111113",
        table_id: "11111111-1111-1111-1111-111111111111",
        action: "REQUEST_BILL",
        status: "ACKNOWLEDGED",
        customer_email: "mesa1@demo.com",
        marketing_opt_in: false,
        session_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        created_at: new Date(now - 3 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 2 * 60 * 1000).toISOString(),
        acknowledged_at: new Date(now - 2 * 60 * 1000).toISOString(),
        resolved_at: null,
        restaurant_tables: {
          id: "11111111-1111-1111-1111-111111111111",
          table_name: "Mesa 1",
          sector: "Salon"
        }
      }
    ]
  };
}

export function getDemoStore() {
  if (!global.__mesaListaDemoStore) {
    global.__mesaListaDemoStore = seedStore();
  }

  return global.__mesaListaDemoStore;
}
