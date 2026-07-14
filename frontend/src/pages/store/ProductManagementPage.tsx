import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import ProductOptionsEditor from "../../components/store/ProductOptionsEditor";
import { api, ApiError } from "../../lib/api";
import { cardClass, mutedTextClass, primaryButtonClass } from "../../lib/ui";
import { Category, Product } from "../../types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProductManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category_id: "" });
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [managingProductId, setManagingProductId] = useState<string | null>(null);
  const newImageInputRef = useRef<HTMLInputElement>(null);
  const managingProduct = products.find((p) => p.id === managingProductId) ?? null;

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

  function validateImageFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "圖片格式僅支援 JPEG、PNG、WebP";
    if (file.size > MAX_IMAGE_BYTES) return "圖片大小不可超過 5MB";
    return null;
  }

  function onNewProductImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        e.target.value = "";
        setNewProductImage(null);
        return;
      }
    }
    setError(null);
    setNewProductImage(file);
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    if (!newProduct.name.trim() || !newProduct.price) return;
    setError(null);
    try {
      const created = await api.post<Product>(
        "/products",
        {
          name: newProduct.name.trim(),
          price: Number(newProduct.price),
          category_id: newProduct.category_id || null,
          is_available: true,
        },
        "store"
      );
      if (newProductImage) {
        const formData = new FormData();
        formData.append("file", newProductImage);
        await api.postForm(`/products/${created.id}/image`, formData, "store");
      }
      setNewProduct({ name: "", price: "", category_id: "" });
      setNewProductImage(null);
      if (newImageInputRef.current) newImageInputRef.current.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "新增商品失敗，請再試一次");
    }
  }

  async function uploadProductImage(productId: string, file: File) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.postForm(`/products/${productId}/image`, formData, "store");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "圖片上傳失敗，請再試一次");
    } finally {
      setUploadingProductId(null);
    }
  }

  async function toggleAvailability(product: Product) {
    await api.patch(`/products/${product.id}/availability`, { is_available: !product.is_available }, "store");
    await refresh();
  }

  async function deleteProduct(id: string) {
    await api.delete(`/products/${id}`, "store");
    await refresh();
  }

  const compactInputClass =
    "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-orange-500/20";
  const compactButtonClass =
    "rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <section className="lg:col-span-1">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">分類管理</h2>
        <form onSubmit={addCategory} className="mb-4 flex gap-2">
          <input
            className={`flex-1 ${compactInputClass}`}
            placeholder="新增分類名稱"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button className={compactButtonClass}>新增</button>
        </form>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className={`${cardClass} flex items-center justify-between p-4 text-gray-900 dark:text-gray-100`}
            >
              <span>{c.name}</span>
              <button className="text-sm font-medium text-red-500 dark:text-red-400" onClick={() => deleteCategory(c.id)}>
                刪除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="lg:col-span-2">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">商品管理</h2>
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}
        <form onSubmit={addProduct} className={`${cardClass} mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-4`}>
          <input
            className={`sm:col-span-2 ${compactInputClass}`}
            placeholder="商品名稱"
            value={newProduct.name}
            onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className={compactInputClass}
            placeholder="價格"
            type="number"
            value={newProduct.price}
            onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
          />
          <select
            className={compactInputClass}
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
          <input
            ref={newImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onNewProductImageChange}
            className="text-sm text-gray-700 sm:col-span-4 dark:text-gray-300"
          />
          <button className={`sm:col-span-4 ${primaryButtonClass}`}>新增商品</button>
        </form>

        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className={`${cardClass} flex items-center justify-between p-4`}>
              <div className="flex items-center gap-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-xs text-gray-400 dark:bg-gray-900 dark:text-gray-500">
                    無圖片
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                  <p className={`text-xs ${mutedTextClass}`}>NT$ {product.price}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer text-xs font-medium text-orange-600 dark:text-orange-400">
                  {uploadingProductId === product.id ? "上傳中…" : product.image_url ? "更換圖片" : "上傳圖片"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingProductId === product.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadProductImage(product.id, file);
                    }}
                  />
                </label>
                <button
                  onClick={() => toggleAvailability(product)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                    product.is_available
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {product.is_available ? "上架中" : "已售完"}
                </button>
                <button
                  className="text-xs font-medium text-orange-600 dark:text-orange-400"
                  onClick={() => setManagingProductId(product.id)}
                >
                  客製化選項
                </button>
                <button
                  className="text-sm font-medium text-red-500 dark:text-red-400"
                  onClick={() => deleteProduct(product.id)}
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {managingProduct && (
        <ProductOptionsEditor
          product={managingProduct}
          onClose={() => setManagingProductId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
