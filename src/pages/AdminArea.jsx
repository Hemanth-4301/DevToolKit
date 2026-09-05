import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import CodeLoader from "../components/CodeLoader";

export default function AdminArea({ auth }) {
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-57px)]">
        <CodeLoader text="checking session..." />
      </div>
    );
  }

  if (!auth.authenticated) {
    return <AdminLogin auth={auth} />;
  }

  return <AdminDashboard auth={auth} />;
}
