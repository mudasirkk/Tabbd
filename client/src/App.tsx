import { Route, Redirect } from "wouter";
import Dashboard from "@/pages/dashboard";
import SignIn from "@/pages/signin";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function App() {
  return (
    <>
       {/* Public Route */}
       <Route path="/signin" component={SignIn} />

      {/* Protected Dashboard */}
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      {/* Catch-all */}
      <Route path="*">
        <Redirect to="/" />
      </Route>
    </>
  );
}
