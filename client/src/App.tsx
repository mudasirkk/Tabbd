import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import Dashboard from "@/pages/dashboard";
import SignIn from "@/pages/signin";
import MenuManagementPage from "./pages/menu";
import ProfilePage from "./pages/profile";
import HistoryPage from "./pages/history";

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = {
  duration: 0.15,
  ease: "easeInOut",
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Switch key={location}>
        {/* Public route */}
        <Route path="/signin">
          <AnimatedPage><SignIn /></AnimatedPage>
        </Route>

        {/* Protected routes */}
        <Route path="/dashboard">
          <AnimatedPage><Dashboard /></AnimatedPage>
        </Route>
        <Route path="/history">
          <AnimatedPage><HistoryPage /></AnimatedPage>
        </Route>
        <Route path="/menu">
          <AnimatedPage><MenuManagementPage /></AnimatedPage>
        </Route>
        <Route path="/settings">
          <AnimatedPage><ProfilePage /></AnimatedPage>
        </Route>

        {/* Default: send unknown paths to signin */}
        <Route>
          {() => {
            window.location.replace("/signin");
            return null;
          }}
        </Route>
      </Switch>
    </AnimatePresence>
  );
}

