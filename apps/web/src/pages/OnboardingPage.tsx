import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { queryClient } from "../lib/query-client";

type Role = { id: string; name: string; description: string };

export function OnboardingPage() {
  const navigate = useNavigate();
  const roles = useQuery({
    queryKey: ["career-roles"],
    queryFn: async () =>
      (await api.get<{ data: Role[] }>("/career-roles")).data.data,
  });
  const [form, setForm] = useState({
    collegeName: "",
    degree: "",
    graduationYear: new Date().getFullYear(),
    experienceLevel: "STUDENT",
    primaryRoleId: "",
    currentSkillLevel: "BEGINNER",
  });
  const save = useMutation({
    mutationFn: async () => {
      await api.patch("/profile", form);
      await api.post("/profile/complete-onboarding");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/app/dashboard");
    },
  });
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <span className="eyebrow">Getting started</span>
        <h1>Tell us about your career goal</h1>
        <p>This decides which scoring formula and role requirements we use.</p>
        <div className="form-grid">
          <label>
            College or university
            <input
              value={form.collegeName}
              onChange={(e) =>
                setForm({ ...form, collegeName: e.target.value })
              }
            />
          </label>
          <label>
            Degree
            <input
              value={form.degree}
              onChange={(e) => setForm({ ...form, degree: e.target.value })}
            />
          </label>
          <label>
            Graduation year
            <input
              type="number"
              value={form.graduationYear}
              onChange={(e) =>
                setForm({ ...form, graduationYear: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Experience level
            <select
              value={form.experienceLevel}
              onChange={(e) =>
                setForm({ ...form, experienceLevel: e.target.value })
              }
            >
              <option value="STUDENT">Student</option>
              <option value="FRESHER">Fresher</option>
              <option value="ZERO_TO_ONE">0–1 year</option>
              <option value="ONE_TO_THREE">1–3 years</option>
              <option value="THREE_PLUS">3+ years</option>
            </select>
          </label>
        </div>
        <h3>Primary target role</h3>
        <div className="role-grid">
          {roles.data?.map((role) => (
            <button
              key={role.id}
              className={
                form.primaryRoleId === role.id
                  ? "role-card selected"
                  : "role-card"
              }
              onClick={() => setForm({ ...form, primaryRoleId: role.id })}
            >
              <strong>{role.name}</strong>
              <span>{role.description}</span>
            </button>
          ))}
        </div>
        {save.error && (
          <div className="error-box">{errorMessage(save.error)}</div>
        )}
        <button
          className="primary-button"
          disabled={
            !form.collegeName ||
            !form.degree ||
            !form.primaryRoleId ||
            save.isPending
          }
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Complete onboarding"}
        </button>
      </div>
    </div>
  );
}
