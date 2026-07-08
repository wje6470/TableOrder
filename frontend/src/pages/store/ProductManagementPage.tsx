import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Category, Product } from "../../types";

export default function ProductManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category_id: "" });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [cats, prods] = await Promise.all([api.get<Category[]>("/categories"), api.get<Product[]>("/products")]);
    setCategories(cats);
    setProducts(prods);
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await api.post("/categories", { name: newCategoryName.trim(), sort_order: categories.length }, "store");
    setNewCategoryName("");
    await refresh();
  }

  async function deleteCategory(id: string) {
    await api.delete(`/categories/${id}`, "store");
    await refresh();
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    if (!newProduct.name.trim() || !newProduct.price) return;
    await api.post(
      "/products",
      {
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        category_id: newProduct.category_id || null,
        is_available: true,
      },
      "store"
    );
    setNewProduct({ name: "", price: "", category_id: "" });
    await refresh();
  }

  async function toggleAvailability(product: Product) {
    await api.patch(`/products/${product.id}/availability`, { is_available: !product.is_available }, "store");
    await refresh();
  }

  async function deleteProduct(id: string) {
    await api.delete(`/products/${id}`, "store");
    await refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <section className="lg:col-span-1">
        <h2 className="mb-3 text-lg font-bold">分類管理</h2>
        <form onSubmit={addCategory} className="mb-3 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="新增分類名稱"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">新增</button>
        </form>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <span>{c.name}</span>
              <button className="text-sm text-red-500" onClick={() => deleteCategory(c.id)}>
                刪除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="lg:col-span-2">
        <h2 className="mb-3 text-lg font-bold">商品管理</h2>
        <form onSubmit={addProduct} className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-white p-4 shadow-sm sm:grid-cols-4">
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="商品名稱"
            value={newProduct.name}
            onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="價格"
            type="number"
            value={newProduct.price}
            onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
          />
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={newProduct.category_id}
            onChange={(e) => setNewProduct((p) => ({ ...p, category_id: e.target.value }))}
          >
            <option value="">未分類</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white sm:col-span-4">新增商品</button>
        </form>

        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-gray-500">NT$ {product.price}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleAvailability(product)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                    product.is_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {product.is_available ? "上架中" : "已售完"}
                </button>
                <button className="text-sm text-red-500" onClick={() => deleteProduct(product.id)}>
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
