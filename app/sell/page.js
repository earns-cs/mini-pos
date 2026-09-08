"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ฟอร์มเลือกสินค้าเพื่อ "เพิ่มลงตะกร้า"
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  // ตะกร้าสินค้าที่จะขายในรอบนี้ (ขายได้หลายรายการ)
  const [cart, setCart] = useState([]);

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

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const quantityNumber = Number(quantity) || 0;

  // ยอดรวมทั้งหมดในตะกร้า (ตัวใหญ่ ๆ ด้านบนสุด)
  const grandTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // จำนวนที่ถูกจองไปแล้วในตะกร้าของสินค้าตัวหนึ่ง ๆ (กันขายเกิน stock)
  function quantityInCart(productId) {
    const item = cart.find((c) => c.product_id === productId);
    return item ? item.quantity : 0;
  }

  // เพิ่มสินค้าลงตะกร้า
  function handleAddToCart(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (!quantity || quantityNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }

    const alreadyInCart = quantityInCart(selectedProduct.id);
    const totalWanted = alreadyInCart + quantityNumber;

    if (totalWanted > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit}, ในตะกร้ามีอยู่แล้ว ${alreadyInCart})`
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === selectedProduct.id);
      if (existing) {
        // ถ้ามีสินค้านี้ในตะกร้าแล้ว ให้บวกจำนวนเพิ่ม
        return prev.map((c) =>
          c.product_id === selectedProduct.id
            ? { ...c, quantity: c.quantity + quantityNumber }
            : c
        );
      }
      // ถ้ายังไม่มี ให้เพิ่มรายการใหม่เข้าตะกร้า
      return [
        ...prev,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          price: selectedProduct.price,
          unit: selectedProduct.unit,
          stock: selectedProduct.stock,
          quantity: quantityNumber,
        },
      ];
    });

    setSelectedProductId("");
    setQuantity("");
  }

  // ลบรายการออกจากตะกร้า
  function handleRemoveFromCart(productId) {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }

  // แก้ไขจำนวนในตะกร้าโดยตรง
  function handleChangeCartQuantity(productId, newQuantity) {
    const num = Number(newQuantity) || 0;
    setCart((prev) =>
      prev.map((c) => (c.product_id === productId ? { ...c, quantity: num } : c))
    );
  }

  function resetAll() {
    setCart([]);
    setSelectedProductId("");
    setQuantity("");
  }

  // ยืนยันการขายทั้งตะกร้า
  async function handleConfirmSale() {
    setErrorMsg("");
    setSuccessMsg("");

    if (cart.length === 0) {
      setErrorMsg("ยังไม่มีสินค้าในตะกร้า");
      return;
    }
    if (cart.some((c) => !c.quantity || c.quantity <= 0)) {
      setErrorMsg("มีรายการที่จำนวนไม่ถูกต้อง กรุณาตรวจสอบตะกร้า");
      return;
    }

    setSubmitting(true);

    // ตรวจสอบ stock ล่าสุดอีกครั้งก่อนบันทึก (กันกรณีข้อมูลเปลี่ยนระหว่างเลือกสินค้า)
    const { data: freshProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, stock")
      .in(
        "id",
        cart.map((c) => c.product_id)
      );

    if (fetchError) {
      setErrorMsg("ตรวจสอบสต็อกไม่สำเร็จ: " + fetchError.message);
      setSubmitting(false);
      return;
    }

    for (const item of cart) {
      const fresh = freshProducts.find((p) => p.id === item.product_id);
      if (!fresh || item.quantity > fresh.stock) {
        setErrorMsg(
          `สินค้า "${item.product_name}" คงเหลือไม่เพียงพอ (คงเหลือ ${fresh ? fresh.stock : 0} ${item.unit})`
        );
        setSubmitting(false);
        return;
      }
    }

    // 1) บันทึกทุกรายการในตะกร้าลงตาราง sales (แถวละ 1 สินค้า)
    const soldAt = new Date().toISOString();
    const salesRows = cart.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from("sales").insert(salesRows);

    if (saleError) {
      setErrorMsg("บันทึกการขายไม่สำเร็จ: " + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าแต่ละตัวในตะกร้า
    for (const item of cart) {
      const fresh = freshProducts.find((p) => p.id === item.product_id);
      const newStock = fresh.stock - item.quantity;
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", item.product_id);

      if (updateError) {
        setErrorMsg(
          `บันทึกการขายสำเร็จ แต่ปรับสต็อกสินค้า "${item.product_name}" ไม่สำเร็จ: ${updateError.message}`
        );
      }
    }

    setSuccessMsg(`ขายสำเร็จ ${cart.length} รายการ ยอดรวม ${grandTotal.toFixed(2)} บาท`);
    resetAll();
    await fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {/* สรุปยอดรวมตัวใหญ่ ไว้บนสุด ให้ทั้งพนักงานและลูกค้าเห็นชัด */}
      <div
        className="card"
        style={{
          textAlign: "center",
          background: "#1f2937",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: "1rem", opacity: 0.8, marginBottom: "4px" }}>ยอดรวมทั้งหมด</div>
        <div style={{ fontSize: "2.8rem", fontWeight: 800, lineHeight: 1.1 }}>
          {grandTotal.toFixed(2)} <span style={{ fontSize: "1.4rem", fontWeight: 500 }}>บาท</span>
        </div>
        <div style={{ fontSize: "0.9rem", opacity: 0.8, marginTop: "4px" }}>
          {cart.length} รายการสินค้า
        </div>
      </div>

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
        <>
          {/* ฟอร์มเพิ่มสินค้าลงตะกร้า */}
          <form className="card" onSubmit={handleAddToCart}>
            <h3 style={{ marginTop: 0 }}>เลือกสินค้าเพื่อเพิ่มลงรายการขาย</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "2 1 220px" }}>
                <label style={{ display: "block", marginBottom: "4px" }}>สินค้า</label>
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
              <div style={{ flex: "1 1 100px" }}>
                <label style={{ display: "block", marginBottom: "4px" }}>จำนวน</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <button type="submit">+ เพิ่มลงรายการ</button>
            </div>
          </form>

          {/* ตะกร้าสินค้าที่จะขายในรอบนี้ */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>รายการที่จะขาย</h3>
            <table>
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th>ราคา/หน่วย</th>
                  <th>จำนวน</th>
                  <th>รวม</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.product_name}</td>
                    <td>
                      {Number(item.price).toFixed(2)} / {item.unit}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleChangeCartQuantity(item.product_id, e.target.value)}
                        style={{ width: "70px" }}
                      />
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {(item.price * item.quantity).toFixed(2)}
                    </td>
                    <td>
                      <button
                        onClick={() => handleRemoveFromCart(item.product_id)}
                        style={{ background: "#dc2626" }}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      ยังไม่มีสินค้าในรายการขาย
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <button
                onClick={handleConfirmSale}
                disabled={submitting || cart.length === 0}
                style={{ fontSize: "1.1rem", padding: "12px 24px", background: "#16a34a" }}
              >
                {submitting ? "กำลังบันทึก..." : "ยืนยันการขาย"}
              </button>
              <button
                onClick={resetAll}
                disabled={submitting || cart.length === 0}
                style={{ background: "#6b7280" }}
              >
                ล้างรายการ
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
