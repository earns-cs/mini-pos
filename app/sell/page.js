"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือก + จำนวนที่จะขาย
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าตอนเข้าเพจ
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg("โหลดข้อมูลสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // หาสินค้าที่ถูกเลือกจาก id
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวมอัตโนมัติ (ราคา x จำนวน)
  const quantityNumber = Number(quantity) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * quantityNumber : 0;

  function resetForm() {
    setSelectedProductId("");
    setQuantity("");
  }

  async function handleSell(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (!quantity || quantityNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }

    // ตรวจสอบ stock คงเหลือว่าเพียงพอหรือไม่
    if (quantityNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: quantityNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg("บันทึกการขายไม่สำเร็จ: " + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - quantityNumber;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    if (updateError) {
      setErrorMsg("ขายสำเร็จ แต่ปรับปรุงสต็อกไม่สำเร็จ: " + updateError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แจ้งเตือน + รีเซ็ตฟอร์ม + โหลดสินค้าใหม่ (stock ล่าสุด)
    setSuccessMsg(
      `ขาย "${selectedProduct.name}" จำนวน ${quantityNumber} ${selectedProduct.unit} สำเร็จ (ยอดรวม ${totalPrice.toFixed(2)} บาท)`
    );
    resetForm();
    await fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && (
        <div className="card" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="card" style={{ background: "#dcfce7", color: "#166534" }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <form className="card" onSubmit={handleSell}>
          {/* Dropdown เลือกสินค้า */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>เลือกสินค้า</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {Number(p.price).toFixed(2)} บาท (คงเหลือ {p.stock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* ช่องกรอกจำนวน */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>จำนวนที่ขาย</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* แสดงยอดรวมอัตโนมัติ */}
          <div style={{ marginBottom: "16px", fontSize: "1.1rem" }}>
            ยอดรวม: <strong>{totalPrice.toFixed(2)} บาท</strong>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? "กำลังบันทึก..." : "ขาย"}
          </button>
        </form>
      )}
    </div>
  );
}
