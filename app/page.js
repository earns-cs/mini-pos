"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ฟอร์มเพิ่มสินค้าใหม่
  const emptyForm = { sku: "", name: "", price: "", stock: "", unit: "" };
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // สถานะแก้ไขแบบ inline: เก็บ id ของแถวที่กำลังแก้ไข + ค่าที่แก้
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // ดึงข้อมูลสินค้าตอนโหลดหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("โหลดข้อมูลสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // เพิ่มสินค้าใหม่
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    const { error } = await supabase.from("products").insert([
      {
        sku: form.sku,
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock),
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg("เพิ่มสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setForm(emptyForm);
      await fetchProducts();
    }
    setSubmitting(false);
  }

  // ลบสินค้า
  async function handleDelete(id) {
    const confirmDelete = window.confirm("ยืนยันการลบสินค้านี้หรือไม่?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setErrorMsg("ลบสินค้าไม่สำเร็จ: " + error.message);
    } else {
      await fetchProducts();
    }
  }

  // เริ่มแก้ไข: โหลดค่าของแถวนั้นเข้า editForm
  function startEdit(product) {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  // บันทึกการแก้ไข
  async function handleUpdate(id) {
    if (!editForm.sku || !editForm.name || !editForm.price || !editForm.stock || !editForm.unit) {
      setErrorMsg("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        unit: editForm.unit,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg("แก้ไขสินค้าไม่สำเร็จ: " + error.message);
    } else {
      cancelEdit();
      await fetchProducts();
    }
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && (
        <div className="card" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {errorMsg}
        </div>
      )}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <form className="card" onSubmit={handleAddProduct}>
        <h3 style={{ marginTop: 0 }}>เพิ่มสินค้าใหม่</h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <input
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="ราคา"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <input
            type="number"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
          <input
            placeholder="หน่วย"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "กำลังเพิ่ม..." : "เพิ่มสินค้า"}
          </button>
        </div>
      </form>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                {editingId === p.id ? (
                  // แถวโหมดแก้ไข (inline)
                  <>
                    <td>
                      <input
                        value={editForm.sku}
                        onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.stock}
                        onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.unit}
                        onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      />
                    </td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => handleUpdate(p.id)}>บันทึก</button>
                      <button onClick={cancelEdit} style={{ background: "#6b7280" }}>
                        ยกเลิก
                      </button>
                    </td>
                  </>
                ) : (
                  // แถวโหมดปกติ
                  <>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td>{p.unit}</td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => startEdit(p)}>แก้ไข</button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        style={{ background: "#dc2626" }}
                      >
                        ลบ
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  ยังไม่มีสินค้าในระบบ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
