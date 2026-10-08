import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DateInput, parseDisplayDate } from "./date-input";

function Field({ initial = "", onValue = () => undefined }: { initial?: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return <label>Ngày hiệu lực<DateInput value={value} onChange={(event) => { setValue(event.target.value); onValue(event.target.value); }} /></label>;
}

describe("DateInput", () => {
  it("shows an ISO value as dd/mm/yyyy and emits ISO once a typed date is complete", () => {
    const onValue = vi.fn();
    render(<Field initial="2026-10-08" onValue={onValue} />);
    const input = screen.getByLabelText("Ngày hiệu lực") as HTMLInputElement;
    expect(input.value).toBe("08/10/2026");
    fireEvent.change(input, { target: { value: "0111" } });
    expect(input.value).toBe("01/11");
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "01112026" } });
    expect(input.value).toBe("01/11/2026");
    expect(onValue).toHaveBeenLastCalledWith("2026-11-01");
    fireEvent.change(input, { target: { value: "" } });
    expect(onValue).toHaveBeenLastCalledWith("");
  });
  it("reverts a partial or impossible date on blur and accepts a pasted ISO date", () => {
    const onValue = vi.fn();
    render(<Field initial="2026-10-08" onValue={onValue} />);
    const input = screen.getByLabelText("Ngày hiệu lực") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31/02/2026" } });
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input.value).toBe("08/10/2026");
    fireEvent.change(input, { target: { value: "2026-12-24" } });
    expect(input.value).toBe("24/12/2026");
    expect(onValue).toHaveBeenLastCalledWith("2026-12-24");
    expect(parseDisplayDate("29/02/2028")).toBe("2028-02-29");
    expect(parseDisplayDate("29/02/2027")).toBeNull();
  });
});
