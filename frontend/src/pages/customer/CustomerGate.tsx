import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { supabase } from "../../lib/supabaseClient";
import { tableConfig } from "../../lib/table";
import TableSetup from "./TableSetup";
import AuthPage from "./AuthPage";

export default function CustomerGate() {
  const { isLoggedIn, logout } = useCustomerAuth();
  const [tableReady, setTableReady] = useState(!!tableConfig.get());
  const tableNumber = tableConfig.get();

  // 店員結帳後 table.status 會變回 idle，藉此偵測並自動登出這桌的顧客，
  // 避免顧客忘記在平板上手動登出、被下一位顧客看到帳號。
  useEffect(() => {
    if (!tableNumber) return;
    const channel = supabase
      .channel(`table-checkout-${tableNumber}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tables", filter: `table_number=eq.${tableNumber}` },
        (payload) => {
          if (payload.new.status === "idle") {
            logout();
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tableNumber, logout]);

  if (!tableReady) {
    return <TableSetup onDone={() => setTableReady(true)} />;
  }
  if (!isLoggedIn) {
    return <AuthPage />;
  }
  return <Outlet />;
}
