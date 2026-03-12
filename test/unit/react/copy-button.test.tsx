import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyButton } from "../../../src/react/copy-button";

describe("CopyButton (React)", () => {
  it("renders with default label", () => {
    render(<CopyButton code="const x = 42;" />);
    expect(screen.getByText("Copy")).toBeDefined();
  });

  it("renders with custom label", () => {
    render(<CopyButton code="code" label="Kopieren" />);
    expect(screen.getByText("Kopieren")).toBeDefined();
  });

  it("has correct aria-label", () => {
    render(<CopyButton code="code" />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Copy");
  });

  it("has type=button", () => {
    render(<CopyButton code="code" />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("applies class prefix", () => {
    render(<CopyButton code="code" classPrefix="my-code" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("my-code-copy-button");
  });

  it("shows copied label after click", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyButton code="const x = 42;" copiedLabel="Done!" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.textContent).toBe("Done!");
    });
  });

  it("calls onCopy callback after successful copy", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const onCopy = vi.fn();
    render(<CopyButton code="hello" onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledWith("hello");
    });
  });

  it("adds copied CSS class after click", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CopyButton code="code" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.className).toContain("neo-hl-copy-button-copied");
    });
  });

  it("accepts additional className", () => {
    render(<CopyButton code="code" className="extra-class" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("extra-class");
  });

  it("accepts additional style", () => {
    render(<CopyButton code="code" style={{ top: "10px" }} />);
    const button = screen.getByRole("button");
    expect(button.style.top).toBe("10px");
  });
});
