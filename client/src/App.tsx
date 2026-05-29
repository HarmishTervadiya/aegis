import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
// Temporary dummy pages
const Dashboard = () => <div className="p-10">Dashboard Page</div>;
const Deposit = () => <div className="p-10">Deposit Page</div>;
const Portfolio = () => <div className="p-10">Portfolio Page</div>;

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
