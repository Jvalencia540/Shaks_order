import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCOP, type OrderItem } from "@/lib/shaks-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Caja — Shaks" },
      { name: "description", content: "Toma de pedidos en caja: elige ítems del menú, asigna beeper y envía a cocina." },
      { property: "og:title", content: "Caja — Shaks" },
      { property: "og:description", content: "Toma pedidos rápido y envíalos a cocina con un toque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CajaPage,
});

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
}

interface PedidoActivo {
  id: string;
  beeper: number;
  estado: string;
}

function CajaPage() {
  const [menu, setMenu] = useState<Producto[]>([]);
  const [pedidosActivos, setPedidosActivos] = useState<PedidoActivo[]>([]);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [beeper, setBeeper] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [sending, setSending] = useState(false);

  // Cargar datos desde Supabase al montar el componente
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingMenu(true);

        // 1. Obtener Menú desde Supabase
        const { data: productosData } = await supabase
          .from("productos")
          .select("*")
          .order("nombre", { ascending: true });

        if (productosData) setMenu(productosData);

        // 2. Obtener Pedidos Activos para deshabilitar Beepers ocupados
        const { data: pedidosData } = await supabase
          .from("pedidos")
          .select("id, beeper, estado")
          .neq("estado", "delivered");

        if (pedidosData) setPedidosActivos(pedidosData);
      } catch (err) {
        console.error("Error al cargar datos de Supabase:", err);
      } font-medium {
        setLoadingMenu(false);
      }
    }

    loadInitialData();
  }, [sent]);

  // Identificar beepers actualmente ocupados en la base de datos
  const occupiedBeepers = useMemo(
    () => new Set(pedidosActivos.map((p) => Number(p.beeper))),
    [pedidosActivos]
  );

  // Mapear el carrito con la información de precios traída de Supabase
  const items: OrderItem[] = [...cart.entries()]
    .filter(([, q]) => q > 0)
    .map(([nombre, qty]) => {
      const m = menu.find((x) => x.nombre === nombre);
      return { name: nombre, qty, price: m ? Number(m.precio) : 0 };
    });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const changeQty = (name: string, delta: number) => {
    setSent(false);
    setCart((prev) => {
      const next = new Map(prev);
      next.set(name, Math.max(0, (next.get(name) ?? 0) + delta));
      return next;
    });
  };

  // Enviar Pedido Real a la tabla 'pedidos' de Supabase
  const send = async () => {
    if (!beeper || items.length === 0 || sending) return;

    try {
      setSending(true);

      const payload = {
        beeper,
        items,
        total,
        estado: "pending",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("pedidos").insert([payload]);

      if (error) {
        console.error("Error al guardar pedido en Supabase:", error);
        alert("Ocurrió un error al enviar el pedido a cocina.");
        return;
      }

      setCart(new Map());
      setBeeper(null);
      setSent(true);
    } catch (err) {
      console.error("Error inesperado:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-3xl text-foreground sm:text-4xl">Toma de Pedidos</h1>
      <p className="mt-1 text-lg text-muted-foreground">
        Toque los ítems para armar el pedido, asigne beeper y envíe a cocina.
      </p>

      {sent && (
        <div className="mt-4 rounded-2xl bg-accent px-5 py-4 text-xl font-bold text-accent-foreground">
          ✅ ¡Pedido enviado a cocina! Entregue el beeper al cliente.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Menú Dinámico desde Supabase */}
        <section aria-label="Menú">
          {loadingMenu ? (
            <p className="py-10 text-center text-lg text-muted-foreground animate-pulse">
              Cargando menú desde Supabase...
            </p>
          ) : menu.length === 0 ? (
            <p className="py-10 text-center text-amber-600">
              No hay productos registrados en la base de datos.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {menu.map((m) => {
                const qty = cart.get(m.nombre) ?? 0;
                return (
                  <button
                    key={m.id || m.nombre}
                    onClick={() => changeQty(m.nombre, 1)}
                    className={`relative min-h-28 rounded-2xl border-4 p-4 text-left shadow-sm transition-transform active:scale-95 ${
                      qty > 0
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="block text-lg font-bold leading-tight sm:text-xl">
                      {m.nombre}
                    </span>
                    <span
                      className={`mt-1 block text-base font-semibold ${
                        qty > 0 ? "text-primary-foreground/90" : "text-muted-foreground"
                      }`}
                    >
                      {formatCOP(Number(m.precio))}
                    </span>
                    {qty > 0 && (
                      <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-gold text-lg font-extrabold text-gold-foreground">
                        {qty}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Resumen + beeper + enviar */}
        <aside className="flex flex-col gap-4 rounded-2xl border-4 border-border bg-card p-5">
          <h2 className="font-display text-2xl text-foreground">Pedido actual</h2>

          <div className="min-h-16 rounded-xl bg-secondary p-3">
            {items.length === 0 ? (
              <p className="text-base text-muted-foreground">Sin ítems todavía…</p>
            ) : (
              <ul className="space-y-1">
                {items.map((i) => (
                  <li
                    key={i.name}
                    className="flex items-center justify-between gap-2 text-base font-semibold"
                  >
                    <span className="min-w-0 truncate">
                      {i.qty}× {i.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {formatCOP(i.price * i.qty)}
                      <button
                        aria-label={`Quitar ${i.name}`}
                        onClick={() => changeQty(i.name, -1)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-destructive text-lg font-bold text-destructive-foreground active:scale-95"
                      >
                        −
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-right text-3xl font-extrabold text-primary">{formatCOP(total)}</p>

          <div>
            <p className="mb-2 text-lg font-bold">Número de beeper</p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
                const busy = occupiedBeepers.has(n);
                const active = beeper === n;
                return (
                  <button
                    key={n}
                    disabled={busy}
                    onClick={() => {
                      setBeeper(n);
                      setSent(false);
                    }}
                    className={`grid h-12 place-items-center rounded-xl text-lg font-extrabold transition-transform active:scale-95 ${
                      active
                        ? "bg-primary text-primary-foreground ring-4 ring-gold"
                        : busy
                        ? "cursor-not-allowed bg-muted text-muted-foreground opacity-40"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={send}
            disabled={!beeper || items.length === 0 || sending}
            className="mt-1 min-h-20 rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground shadow-lg transition-transform enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "ENVIANDO..." : "🚀 ENVIAR A COCINA"}
          </button>
        </aside>
      </div>
    </main>
  );
}
