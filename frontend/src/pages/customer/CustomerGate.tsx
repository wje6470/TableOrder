import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { tableConfig } from "../../lib/table";
import TableSetup from "./TableSetup";
import AuthPage from "./AuthPage";

export default function CustomerGate() {
  const { isLoggedIn } = useCustomerAuth();
  const [tableReady, setTableReady] = useState(!!tableConfig.get());

  if (!tableReady) {
    return <TableSetup onDone={() => setTableReady(true)} />;
  }
  if (!isLoggedIn) {
    return <AuthPage />;
  }
  return <Outlet />;
}
