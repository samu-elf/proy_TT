import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
}

export default function ProductoDetalle() {
  const { id } = useParams();
  const [producto, setProducto] = useState<Producto | null>(null);

  useEffect(() => {
    setProducto({
      id: Number(id),
      nombre: "Producto ejemplo",
      descripcion: "Descripción del producto",
      precio: 50
    });
  }, [id]);

  const agregarCarrito = () => {
    const carrito = JSON.parse(localStorage.getItem("carrito") || "[]");

    carrito.push({
      id: producto?.id,
      nombre: producto?.nombre,
      precio: producto?.precio,
      cantidad: 1
    });

    localStorage.setItem("carrito", JSON.stringify(carrito));
    alert("Agregado al carrito");
  };

  if (!producto) return <p className="container py-4">Cargando...</p>;

  return (
    <div className="container py-4">
      <div className="card shadow-sm p-3">
        <h2>{producto.nombre}</h2>
        <p>{producto.descripcion}</p>
        <h4>Bs {producto.precio}</h4>

        <button className="btn btn-success" onClick={agregarCarrito}>
          Agregar al carrito
        </button>
      </div>
    </div>
  );
}