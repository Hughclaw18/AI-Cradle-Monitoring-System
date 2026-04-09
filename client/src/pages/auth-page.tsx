import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, Baby } from "lucide-react";
import type { InsertUser } from "@shared/schema";

export default function AuthPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => { if (user) setLocation("/"); }, [user, setLocation]);
  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2 bg-background">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-center gap-3 pt-10 pb-4 px-4">
        <div className="p-2.5 bg-primary/10 rounded-2xl">
          <Baby className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary leading-none">Smart Cradle</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Nursery Intelligence System</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-start lg:justify-center px-4 pb-8 lg:p-8">
        <Card className="w-full max-w-sm lg:max-w-md shadow-xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold">Welcome back</CardTitle>
            <CardDescription className="text-sm">Sign in to your Smart Cradle account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login"><LoginForm /></TabsContent>
              <TabsContent value="register"><RegisterForm /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Desktop hero panel */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-primary/5 border-l border-border/30">
        <div className="max-w-md space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Baby className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Smart Cradle Monitor</h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Monitor your baby's sleep, track patterns, and get instant alerts with our advanced AI monitoring system.
          </p>
          {[
            "Real-time posture & object detection",
            "Automatic crying detection & lullaby response",
            "SMS alerts via Twilio",
            "7-day sleep history & analytics",
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ field, show, onToggle }: { field: any; show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} {...field} className="pr-10" />
      <button type="button" onClick={onToggle} tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const [show, setShow] = useState(false);
  const form = useForm({ defaultValues: { username: "", password: "" } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => loginMutation.mutate(d))} className="space-y-3 mt-3">
        <FormField control={form.control} name="username" render={({ field }) => (
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl><Input {...field} autoComplete="username" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><PasswordInput field={field} show={show} onToggle={() => setShow(v => !v)} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full h-11 mt-1" disabled={loginMutation.isPending}>
          {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Login
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const [show, setShow] = useState(false);
  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "", name: "", address: "", email: "", phone: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(d => registerMutation.mutate(d))} className="space-y-3 mt-3">
        {[
          { name: "name" as const,     label: "Full Name", type: "text" },
          { name: "username" as const, label: "Username",  type: "text" },
          { name: "email" as const,    label: "Email",     type: "email" },
          { name: "phone" as const,    label: "Phone",     type: "tel" },
          { name: "address" as const,  label: "Address",   type: "text" },
        ].map(({ name, label, type }) => (
          <FormField key={name} control={form.control} name={name} render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl><Input type={type} {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ))}
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><PasswordInput field={field} show={show} onToggle={() => setShow(v => !v)} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full h-11 mt-1" disabled={registerMutation.isPending}>
          {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </Form>
  );
}
