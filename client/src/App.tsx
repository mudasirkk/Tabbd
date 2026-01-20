import { Route, Switch } from "wouter";
import Dashboard from "@/pages/dashboard";
import SignIn from "@/pages/signin";
import MenuManagementPage from "./pages/menu";
import ProfilePage from "./pages/profile";

export default function App() {
  return (
    <Switch>
      {/* Public route */}
      <Route path="/signin" component={SignIn} />

      {/* Protected route */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/menu" component={MenuManagementPage} />
      <Route path="/profile" component={ProfilePage} />

      {/* Default: send unknown paths to signin */}
      <Route>
        {() => {
          window.location.replace("/signin");
          return null;
        }}
      </Route>
    </Switch>
  );
}

