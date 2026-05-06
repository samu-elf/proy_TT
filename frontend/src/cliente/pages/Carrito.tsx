import { useEffect, useState } from "react";

interface Item {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function Carrito() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const data = localStorage.getItem("carrito");
    if (data) setItems(JSON.parse(data));
  }, []);

  const eliminar = (id: number) => {
    const nuevo = items.filter(i => i.id !== id);
    setItems(nuevo);
    localStorage.setItem("carrito", JSON.stringify(nuevo));
  };

  const total = items.reduce((a, i) => a + i.precio * i.cantidad, 0);

  return (
    <div className="container py-4">
      <h2>🛒 Carrito</h2>

      {items.map(i => (
        <div className="card mb-2 shadow-sm" key={i.id}>
          <div className="card-body d-flex justify-content-between">
            <div>
              <h5>{i.nombre}</h5>
              <small>Cantidad: {i.cantidad}</small>
            </div>

            <div>
              <b>Bs {i.precio * i.cantidad}</b>
              <button className="btn btn-danger btn-sm ms-3" onClick={() => eliminar(i.id)}>
                X
              </button>
            </div>
          </div>
        </div>
      ))}

      <hr />
      <h4>Total: Bs {total}</h4>

      <button className="btn btn-primary w-100 mt-3">
        Finalizar compra
      </button>
    </div>
  );
}