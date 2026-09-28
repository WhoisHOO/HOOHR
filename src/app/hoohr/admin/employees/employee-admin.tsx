"use client";

import { useActionState } from "react";
import {
  createDepartment,
  deactivateEmployee,
  deleteDepartment,
  reactivateEmployee,
  updateDepartment,
  updateEmployeeProfile,
} from "@/app/actions/employees";
import { reinviteEmployee } from "@/app/actions/auth";
import type { FieldErrors, InviteState } from "@/lib/auth-validation";
import type {
  DepartmentCreateState,
  DepartmentDeleteState,
  DepartmentUpdateState,
  EmployeeProfileState,
  EmployeeStatusState,
} from "@/lib/employee-validation";
import { interpolate, useI18n } from "@/i18n/client";

export type DepartmentView = {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  employeeCount: number;
};

export type ApproverOption = {
  id: string;
  name: string;
  email: string;
};

export type EmployeeView = {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  position: string | null;
  hireDate: string;
  status: string;
  currentApproverId: string | null;
  currentApproverName: string | null;
};

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const primaryButtonClass =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

function Message({ state }: { state?: { message?: string; ok?: boolean } }) {
  if (!state?.message) return null;
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}

function FieldError({
  state,
  name,
}: {
  state?: { fieldErrors?: FieldErrors };
  name: string;
}) {
  const message = state?.fieldErrors?.[name]?.[0];
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const { d } = useI18n();
  const label =
    status === "ACTIVE"
      ? d.common.employmentStatus.ACTIVE
      : status === "INVITED"
        ? d.common.employmentStatus.INVITED
        : d.admin.status.inactive;
  const color =
    status === "ACTIVE"
      ? "bg-green-100 text-green-700"
      : status === "INVITED"
        ? "bg-amber-100 text-amber-700"
        : "bg-zinc-100 text-zinc-600";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function CreateDepartmentForm() {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<DepartmentCreateState, FormData>(
    createDepartment,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="new-department-name" className="text-sm font-medium text-zinc-700">
          {d.admin.departments.newNameField}
        </label>
        <input
          id="new-department-name"
          name="name"
          type="text"
          required
          placeholder={d.admin.departments.namePlaceholder}
          className={inputClass}
        />
        <FieldError state={state} name="name" />
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? d.admin.departments.creating : d.admin.departments.create}
      </button>
      <Message state={state} />
    </form>
  );
}

function DepartmentRow({
  department,
  managerOptions,
}: {
  department: DepartmentView;
  managerOptions: ApproverOption[];
}) {
  const { d } = useI18n();
  const [updateState, updateAction, updatePending] = useActionState<
    DepartmentUpdateState,
    FormData
  >(updateDepartment, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState<
    DepartmentDeleteState,
    FormData
  >(deleteDepartment, undefined);

  return (
    <article className="rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900">{department.name}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {interpolate(d.admin.departments.managerMeta, {
              managerName: department.managerName ?? d.admin.unassigned,
              employeeCount: department.employeeCount,
            })}
          </p>
        </div>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={department.id} />
          <button type="submit" disabled={deletePending} className={dangerButtonClass}>
            {deletePending ? d.admin.departments.deleting : d.common.actions.delete}
          </button>
        </form>
      </div>

      <form
        action={updateAction}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <input type="hidden" name="id" value={department.id} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`department-name-${department.id}`} className="text-xs font-medium text-zinc-500">
            {d.admin.departments.nameField}
          </label>
          <input
            id={`department-name-${department.id}`}
            name="name"
            type="text"
            required
            defaultValue={department.name}
            className={inputClass}
          />
          <FieldError state={updateState} name="name" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`department-manager-${department.id}`} className="text-xs font-medium text-zinc-500">
            {d.admin.departments.managerField}
          </label>
          <select
            id={`department-manager-${department.id}`}
            name="managerId"
            defaultValue={department.managerId ?? ""}
            className={inputClass}
          >
            <option value="">{d.admin.unassigned}</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} ({manager.email})
              </option>
            ))}
          </select>
          <FieldError state={updateState} name="managerId" />
        </div>
        <button type="submit" disabled={updatePending} className={secondaryButtonClass}>
          {updatePending ? d.common.buttons.saving : d.common.actions.save}
        </button>
      </form>
      <div className="mt-3 space-y-2">
        <Message state={updateState} />
        <Message state={deleteState} />
      </div>
    </article>
  );
}

function DepartmentSection({
  departments,
  managerOptions,
}: {
  departments: DepartmentView[];
  managerOptions: ApproverOption[];
}) {
  const { d } = useI18n();
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{d.admin.departments.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {d.admin.departments.hint}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {interpolate(d.admin.departments.count, { count: departments.length })}
        </span>
      </div>

      <div className="mt-5 border-b border-zinc-100 pb-5">
        <CreateDepartmentForm />
      </div>

      <div className="mt-5 space-y-3">
        {departments.length === 0 ? (
          <p className="text-sm text-zinc-500">{d.admin.departments.empty}</p>
        ) : (
          departments.map((department) => (
            <DepartmentRow
              key={department.id}
              department={department}
              managerOptions={managerOptions}
            />
          ))
        )}
      </div>
    </section>
  );
}

function EmployeeProfileForm({
  employee,
  departments,
  approverOptions,
}: {
  employee: EmployeeView;
  departments: DepartmentView[];
  approverOptions: ApproverOption[];
}) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<EmployeeProfileState, FormData>(
    updateEmployeeProfile,
    undefined,
  );

  return (
    <form action={action} className="mt-4 border-t border-zinc-100 pt-4">
      <input type="hidden" name="id" value={employee.id} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`employee-department-${employee.id}`} className="text-xs font-medium text-zinc-500">
            {d.common.fields.department}
          </label>
          <select
            id={`employee-department-${employee.id}`}
            name="departmentId"
            defaultValue={employee.departmentId ?? ""}
            className={inputClass}
          >
            <option value="">{d.admin.unassigned}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <FieldError state={state} name="departmentId" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`employee-position-${employee.id}`} className="text-xs font-medium text-zinc-500">
            {d.common.fields.position}
          </label>
          <input
            id={`employee-position-${employee.id}`}
            name="position"
            type="text"
            defaultValue={employee.position ?? ""}
            placeholder={d.admin.employees.positionPlaceholder}
            className={inputClass}
          />
          <FieldError state={state} name="position" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`employee-hire-date-${employee.id}`} className="text-xs font-medium text-zinc-500">
            {d.admin.employees.hireDate}
          </label>
          <input
            id={`employee-hire-date-${employee.id}`}
            name="hireDate"
            type="date"
            defaultValue={employee.hireDate}
            className={inputClass}
          />
          <FieldError state={state} name="hireDate" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`employee-approver-${employee.id}`} className="text-xs font-medium text-zinc-500">
            {d.admin.employees.approver}
          </label>
          <select
            id={`employee-approver-${employee.id}`}
            name="leaveApproverId"
            defaultValue={employee.currentApproverId ?? ""}
            className={inputClass}
          >
            <option value="">{d.admin.unassigned}</option>
            {approverOptions.map((approver) => (
              <option key={approver.id} value={approver.id} disabled={approver.id === employee.id}>
                {approver.name} ({approver.email})
              </option>
            ))}
          </select>
          <FieldError state={state} name="leaveApproverId" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? d.common.buttons.saving : d.admin.employees.saveProfile}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

function DeactivateEmployeeForm({ employeeId }: { employeeId: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<EmployeeStatusState, FormData>(
    deactivateEmployee,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={employeeId} />
      <button type="submit" disabled={pending} className={dangerButtonClass}>
        {pending ? d.admin.employees.processing : d.admin.employees.deactivate}
      </button>
      <Message state={state} />
    </form>
  );
}

function ReactivateEmployeeForm({ employeeId }: { employeeId: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<EmployeeStatusState, FormData>(
    reactivateEmployee,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={employeeId} />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? d.admin.employees.processing : d.admin.employees.reactivate}
      </button>
      <Message state={state} />
    </form>
  );
}

function ReinviteEmployeeForm({ employeeId }: { employeeId: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<InviteState, FormData>(
    reinviteEmployee,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="role" defaultValue="EMPLOYEE" className={inputClass}>
          <option value="EMPLOYEE">{d.admin.employees.reinviteRoleEmployee}</option>
          <option value="MANAGER">{d.admin.employees.reinviteRoleManager}</option>
        </select>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? d.admin.employees.reinviting : d.admin.employees.reinvite}
        </button>
      </div>
      {state?.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.inviteUrl ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
      {state?.inviteUrl && (
        <input
          readOnly
          value={state.inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
        />
      )}
    </form>
  );
}

function EmployeeStatusSection({ employee }: { employee: EmployeeView }) {
  const { d } = useI18n();
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-xs font-medium text-zinc-500">{d.admin.employees.statusManagement}</p>
      <div className="mt-2">
        {employee.status === "ACTIVE" ? (
          <DeactivateEmployeeForm employeeId={employee.id} />
        ) : employee.status === "INACTIVE" ? (
          <ReactivateEmployeeForm employeeId={employee.id} />
        ) : (
          <ReinviteEmployeeForm employeeId={employee.id} />
        )}
      </div>
    </div>
  );
}

function EmployeeCard({
  employee,
  departments,
  approverOptions,
}: {
  employee: EmployeeView;
  departments: DepartmentView[];
  approverOptions: ApproverOption[];
}) {
  const { d } = useI18n();
  return (
    <article className="rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900">{employee.name}</h3>
          <p className="mt-1 text-sm text-zinc-500">{employee.email}</p>
        </div>
        <StatusBadge status={employee.status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-400">{d.common.fields.department}</dt>
          <dd className="mt-1 text-zinc-700">{employee.departmentName ?? d.admin.unassigned}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">{d.common.fields.position}</dt>
          <dd className="mt-1 text-zinc-700">{employee.position ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">{d.admin.employees.hireDate}</dt>
          <dd className="mt-1 text-zinc-700">{employee.hireDate || "-"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">{d.admin.employees.currentApprover}</dt>
          <dd className="mt-1 text-zinc-700">{employee.currentApproverName ?? d.admin.unassigned}</dd>
        </div>
      </dl>

      <EmployeeProfileForm
        employee={employee}
        departments={departments}
        approverOptions={approverOptions}
      />
      <EmployeeStatusSection employee={employee} />
    </article>
  );
}

function EmployeeSection({
  employees,
  departments,
  approverOptions,
}: {
  employees: EmployeeView[];
  departments: DepartmentView[];
  approverOptions: ApproverOption[];
}) {
  const { d } = useI18n();
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{d.admin.employees.sectionTitle}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {d.admin.employees.sectionHint}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {interpolate(d.admin.employees.count, { count: employees.length })}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {employees.length === 0 ? (
          <p className="text-sm text-zinc-500">{d.admin.employees.empty}</p>
        ) : (
          employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              departments={departments}
              approverOptions={approverOptions}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function EmployeeAdmin({
  departments,
  employees,
  managerOptions,
  approverOptions,
}: {
  departments: DepartmentView[];
  employees: EmployeeView[];
  managerOptions: ApproverOption[];
  approverOptions: ApproverOption[];
}) {
  return (
    <div className="space-y-8">
      <DepartmentSection departments={departments} managerOptions={managerOptions} />
      <EmployeeSection
        employees={employees}
        departments={departments}
        approverOptions={approverOptions}
      />
    </div>
  );
}
