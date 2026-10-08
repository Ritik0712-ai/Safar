"use client";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  MapPin,
  LoaderCircle,
  AlertCircle,
  X,
  Route,
  Check,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  useRef,
  useEffect,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
export function Brand({
  href = "/",
  light = false,
}: {
  href?: string;
  light?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Safar home"
    >
      <span className="brand-symbol">
        <Route size={23} strokeWidth={2} />
      </span>
      <span>
        safar<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
export function Button({
  children,
  busy = false,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
      aria-busy={busy}
    >
      {busy && <LoaderCircle size={18} className="spin" />}
      {children}
    </button>
  );
}
export function Banner({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success" | "warning";
}) {
  return (
    <div
      className={`banner ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  icon: Icon = MapPin,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={30} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-panel" role="status" aria-label="Loading">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-line" />
      <div className="skeleton sk-block" />
      <span className="sr-only">Loading your workspace</span>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value}`}>
      <span className="status-dot" />
      {value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
    </span>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={22} />
            </Dialog.Close>
          </div>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Endpoints({
  pickup,
  destination,
}: {
  pickup: string;
  destination: string;
}) {
  return (
    <div className="endpoints">
      <div>
        <span className="point-circle" />
        <p>
          <small>Pickup</small>
          {pickup}
        </p>
      </div>
      <div>
        <span className="point-square" />
        <p>
          <small>Destination</small>
          {destination}
        </p>
      </div>
    </div>
  );
}
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="page-heading">
      <div>
        <h1 ref={ref} tabIndex={-1}>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ChevronRight size={17} />
    </Link>
  );
}
export function Steps({ status }: { status: string }) {
  const names = [
    ["searching", "Finding a driver"],
    ["assigned", "Driver on the way"],
    ["arrived", "Ready at pickup"],
    ["in_progress", "Ride in progress"],
    ["completed", "Arrived at destination"],
  ];
  const index = names.findIndex((n) => n[0] === status);
  return (
    <ol className="timeline">
      {names.map(([key, name], i) => (
        <li
          key={key}
          className={i === index ? "current" : i < index ? "done" : ""}
        >
          <span>{i < index ? <Check size={14} /> : <span />}</span>
          <p>
            {name}
            {i === index && <small>Current stage</small>}
          </p>
        </li>
      ))}
    </ol>
  );
}
