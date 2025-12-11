import { Switch, Route, Redirect } from "wouter";
import Dashboard from "@/pages/dashboard";
import SignIn from "@/pages/signin";
import ProtectedRoute from "@/components/ProtectedRoute";

function App() {
  return (
    <Switch>
      {/* Sign in page */}
      <Route path="/signin" component={SignIn} />

      {/* Protected home/dashboard */}
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      {/* Catch-all redirect */}
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

export default App;
