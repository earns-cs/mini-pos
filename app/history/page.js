"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // โหลดประวัติการขายตอนเข้าเพจ
  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    setErrorMsg("");

    // ดึงข้อมูลทั้งหมดจากตาราง sales เรียงจากล่าสุดไปเก่าสุด
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("sold_at", { ascending: false });

    if (error) {
      setErrorMsg("โหลดประวัติการขายไม่สำเร็จ: " + error.message);
    } else {
      setSales(data);
    }
    setLoading(false);
  }

  // คำนวณยอดขายรวมทั้งหมดจาก total_price ของทุกแถว
  const grandTotal = sales.reduce((sum, s) => sum + Number(s.total_price), 0);

  // แปลงเวลาให้อ่านง่าย (แบบไทย)
  function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {errorMsg && (
        <div className="card" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {errorMsg}
        </div>
      )}

      {/* สรุปยอดขายรวมทั้งหมด */}
      <div className="card" style={{ fontSize: "1.1rem" }}>
        ยอดขายรวมทั้งหมด: <strong>{grandTotal.toFixed(2)} บาท</strong>
        <span style={{ marginLeft: "12px", color: "#6b7280", fontSize: "0.9rem" }}>
          ({sales.length} รายการ)
        </span>
      </div>

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{formatDateTime(s.sold_at)}</td>
                <td>{s.product_name}</td>
                <td>{s.quantity}</td>
                <td>{Number(s.total_price).toFixed(2)}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  ยังไม่มีประวัติการขาย
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
