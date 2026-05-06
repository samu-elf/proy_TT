import { useEffect, useState } from "react";

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);

  useEffect(() => {
    setPedidos([
      { id: 1, fecha: "2026-05-01", total: 120, estado: "Entregado" },
      { id: 2, fecha: "2026-05-03", total: 80, estado: "En camino" }
    ]);
  }, []);

  return (
    <div className="container py-4">
      <h2>📦 Mis pedidos</h2>

      {pedidos.map(p => (
        <div className="card mb-3 shadow-sm" key={p.id}>
          <div className="card-body">
            <h5>Pedido #{p.id}</h5>
            <p>Fecha: {p.fecha}</p>
            <p>Total: Bs {p.total}</p>

            <span className="badge bg-success">
              {p.estado}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}