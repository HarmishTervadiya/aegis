import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Deposit from "./pages/Deposit";
import Portfolio from "./pages/Portfolio";
import Activity from "./pages/Activity";
import WelcomeModal from "./components/tour/WelcomeModal";
import TourTooltip from "./components/tour/TourTooltip";
import TourButton from "./components/tour/TourButton";

export default function App() {
  return (
    <>
      <WelcomeModal />
      <TourTooltip />
      <TourButton />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
}
