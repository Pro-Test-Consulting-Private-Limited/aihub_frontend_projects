"use client";

import { useEffect, useState } from "react";
import { useProjects } from "@/app/lib/projectsStore";
import Breadcrumbs from "@/app/components/breadcrumbs";
import { ProjectBreadcrumbs } from "@/app/constants/projects";
import AuthGuard from "@/app/lib/authguard";

const STEPS = [
  { label: "Basic Info", key: "basic" },
  { label: "Target App", key: "target" },
];

const DEPARTMENTS = [
  "Information Technology",
  "Operations",
  "Management",
  "Finance",
  "Human Resources",
  "Sales and Marketing",
];

const AUTH_TYPES = ["Username & Password", "OAuth 2.0", "Microsoft Entra ID", "SAML SSO", "API Key"];

function todayFormatted() {
  const d = new Date();
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(",", "");
}

export default function Projects() {
  const { projects, addProject, updateProject, deleteProject } = useProjects();

  // ---- Which page we're showing ----
  const [mode, setMode] = useState<"create" | "view">("view");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // ---- Wizard state (only used while creating a NEW project) ----
  const [current, setCurrent] = useState(0);
  const goPrev = () => current > 0 && setCurrent(current - 1);
  const goNext = () => current < STEPS.length - 1 && setCurrent(current + 1);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("Testing");
  const [selectedDept, setSelectedDept] = useState("Information Technology");
  const [workspace, setWorkspace] = useState("Pro Test");
  const [appUrl, setAppUrl] = useState("");
  const [authRequired, setAuthRequired] = useState(true);
  const [authType, setAuthType] = useState("Username & Password");

  const startCreate = () => {
    setProjectName("");
    setDescription("");
    setSelectedDomain("Testing");
    setSelectedDept("Information Technology");
    setWorkspace("Pro Test");
    setAppUrl("");
    setAuthRequired(true);
    setAuthType("Username & Password");
    setCurrent(0);
    setSelectedProjectId(null);
    setMode("create");
  };

  // ---- Edit state (used while viewing/editing an EXISTING project) ----
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editWorkspace, setEditWorkspace] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editAppUrl, setEditAppUrl] = useState("");
  const [editAuthRequired, setEditAuthRequired] = useState(true);
  const [editAuthType, setEditAuthType] = useState("Username & Password");

  useEffect(() => {
    if (selectedProject) {
      setEditName(selectedProject.name);
      setEditDescription(selectedProject.description);
      setEditWorkspace(selectedProject.workspace);
      setEditDept(selectedProject.department);
      setEditAppUrl(selectedProject.applicationUrl);
      setEditAuthRequired(selectedProject.authRequired);
      setEditAuthType(selectedProject.authType || "Username & Password");
      setEditingBasic(false);
      setEditingTarget(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const handleSaveBasic = () => {
    if (!selectedProjectId) return;
    updateProject(selectedProjectId, {
      name: editName,
      description: editDescription,
      workspace: editWorkspace,
      department: editDept,
    });
    setEditingBasic(false);
  };

  const handleSaveTarget = () => {
    if (!selectedProjectId) return;
    updateProject(selectedProjectId, {
      applicationUrl: editAppUrl,
      authRequired: editAuthRequired,
      authType: editAuthType,
    });
    setEditingTarget(false);
  };

  const pageTitle =
    mode === "create" ? "Create New Project" : selectedProject ? selectedProject.name : "Projects";

  return (
    <AuthGuard>
      <div className="p-6 pb-[4.5rem] h-full overflow-y-auto">
        <Breadcrumbs breadcrumbs={ProjectBreadcrumbs} />

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Poppins:wght@400;500;600&display=swap');

          .aihub-root{
            --purple:#8664F2; --purple2:#A05DFF; --blue-accent:#3860C7;
            --ink:#000C26; --tint:#F2EBFB; --line:#E6E1F5; --gray:#6B7280;
            --green:#1FA971; --orange:#E1962E; --white:#fff;
            font-family:'Poppins',sans-serif; color:var(--ink);
          }
          .aihub-root h1,.aihub-root h2,.aihub-root h3{font-family:'DM Sans',sans-serif;}
          .aihub-main{max-width:1040px; margin-top:20px;}
          .aihub-crumb{font-size:12px; color:var(--gray); margin-bottom:6px;}
          .aihub-crumb b{color:var(--purple);}
          .aihub-topbar{display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;}
          .aihub-pagetitle{font-size:22px; font-weight:700; margin:0;}

          .aihub-mode-toggle{
            display:flex; align-items:center; gap:8px; font-size:11px; color:var(--gray);
          }
          .aihub-mode-switch{
            width:36px; height:20px; border-radius:20px; position:relative; cursor:pointer;
            background:var(--line); flex-shrink:0; transition:background 0.15s;
          }
          .aihub-mode-switch.on{background:var(--purple);}
          .aihub-mode-knob{
            width:16px; height:16px; border-radius:50%; background:#fff; position:absolute; top:2px;
            box-shadow:0 1px 2px rgba(0,0,0,.2); transition:left 0.15s;
          }

          .aihub-stepper{display:flex; align-items:center; margin-bottom:30px; overflow-x:auto; padding-bottom:6px;}
          .aihub-step{display:flex; align-items:center; flex-shrink:0; cursor:pointer;}
          .aihub-step .circle{
            width:26px;height:26px;border-radius:50%; display:flex; align-items:center; justify-content:center;
            font-size:11.5px; font-weight:700; border:2px solid var(--line); color:var(--gray); background:#fff;
            font-family:'DM Sans',sans-serif;
          }
          .aihub-step .label{font-size:11.5px; color:var(--gray); margin:0 8px 0 6px; white-space:nowrap;}
          .aihub-step.done .circle{background:var(--green); border-color:var(--green); color:#fff;}
          .aihub-step.done .label{color:var(--ink);}
          .aihub-step.current .circle{background:var(--purple); border-color:var(--purple); color:#fff; box-shadow:0 0 0 4px var(--tint);}
          .aihub-step.current .label{color:var(--purple); font-weight:600;}
          .aihub-connector{width:26px; height:2px; background:var(--line); flex-shrink:0;}
          .aihub-connector.done{background:var(--green);}

          .aihub-card{
            background:var(--white); border:1px solid var(--line); border-radius:14px; padding:28px 30px;
            box-shadow:0 1px 2px rgba(0,12,38,.03); margin-bottom:20px;
          }
          .aihub-card h3{font-size:15px; margin:0 0 4px;}
          .aihub-card .hint{font-size:12px; color:var(--gray); margin-bottom:18px;}
          .aihub-card label{display:block; font-size:12.5px; font-weight:600; margin-bottom:6px; color:#222;}
          .aihub-field{margin-bottom:18px;}
          .aihub-card input[type=text], .aihub-card input[type=url], .aihub-card select, .aihub-card textarea{
            width:100%; padding:9px 12px; border:1px solid var(--line); border-radius:8px; font-size:13px;
            font-family:'Poppins',sans-serif; color:var(--ink); background:#FDFCFF;
          }
          .aihub-card input:focus, .aihub-card select:focus, .aihub-card textarea:focus{
            outline:none; border-color:var(--purple); box-shadow:0 0 0 3px var(--tint);
          }
          .aihub-helper{font-size:11px; color:var(--gray); margin-top:4px;}

          .aihub-domain-grid{display:flex; gap:12px; flex-wrap:wrap;}
          .aihub-domain-card{
            width:150px; border:1.5px solid var(--line); border-radius:10px; padding:14px; cursor:pointer; position:relative;
          }
          .aihub-domain-card.selected{border-color:var(--purple); background:var(--tint);}
          .aihub-domain-card .emoji{font-size:20px;}
          .aihub-domain-card .dname{font-weight:600; font-size:13px; margin:6px 0 2px;}
          .aihub-domain-card .ddesc{font-size:10.5px; color:var(--gray); line-height:1.3;}
          .aihub-badge-avail{
            position:absolute; top:8px; right:8px; font-size:8.5px; background:#E6F8EF; color:var(--green);
            padding:2px 6px; border-radius:20px; font-weight:600;
          }

          .aihub-dept-pills{display:flex; gap:10px; flex-wrap:wrap;}
          .aihub-dept-pill{
            padding:9px 18px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;
            border:1px solid var(--line); color:#444; background:#fff;
          }
          .aihub-dept-pill.active{background:var(--purple); border-color:var(--purple); color:#fff;}

          .aihub-int-btn{width:100%; padding:8px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; border:none;}
          .aihub-int-btn.outline{background:#fff; border:1.5px solid var(--purple); color:var(--purple);}

          .aihub-footer-nav{display:flex; justify-content:space-between; margin-top:22px;}
          .aihub-footer-left, .aihub-footer-right{display:flex; gap:10px;}
          .aihub-btn{padding:9px 18px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; border:none;}
          .aihub-btn.ghost{background:#fff; border:1.5px solid var(--line); color:#444;}
          .aihub-btn.primary{background:linear-gradient(135deg,var(--purple),var(--purple2)); color:#fff;}
          .aihub-btn:disabled{opacity:.4; cursor:default;}

          .aihub-view-hero{
            display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;
          }
          .aihub-view-badges{display:flex; gap:8px; align-items:center; margin-bottom:8px;}
          .aihub-badge{
            font-size:11px; font-weight:600; padding:4px 10px; border-radius:20px;
          }
          .aihub-badge.domain{background:var(--tint); color:var(--purple);}
          .aihub-badge.dept{background:#EFF3FE; color:var(--blue-accent);}
          .aihub-badge.status{background:#EAFBF3; color:#12724E;}
          .aihub-view-desc{font-size:13px; color:var(--gray); max-width:600px;}

          .aihub-view-card-head{display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;}
          .aihub-edit-link{
            font-size:12px; font-weight:600; color:var(--purple); cursor:pointer; background:none; border:none;
            display:flex; align-items:center; gap:4px;
          }
          .aihub-view-row{display:flex; padding:10px 0; border-bottom:1px solid var(--line); font-size:13px;}
          .aihub-view-row:last-child{border-bottom:none;}
          .aihub-view-row .k{width:180px; flex-shrink:0; color:var(--gray); font-weight:600;}
          .aihub-view-row .v{color:var(--ink);}
          .aihub-save-row{display:flex; gap:10px; margin-top:16px;}

          .aihub-back-link{
            font-size:12.5px; font-weight:600; color:var(--purple); background:none; border:none;
            cursor:pointer; margin-bottom:14px; display:inline-flex; align-items:center; gap:4px;
          }
          .aihub-new-btn{
            padding:9px 16px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer;
            border:none; background:linear-gradient(135deg,var(--purple),var(--purple2)); color:#fff;
          }
          .aihub-list-row{
            display:flex; justify-content:space-between; align-items:center; padding:14px 4px;
            border-bottom:1px solid var(--line); cursor:pointer;
          }
          .aihub-list-row:last-child{border-bottom:none;}
          .aihub-list-row:hover{background:#FAFAFC;}
          .aihub-list-name{font-size:14px; font-weight:600; color:var(--ink);}
          .aihub-list-meta{display:flex; align-items:center; gap:10px;}
          .aihub-list-date{font-size:12px; color:var(--gray);}
          .aihub-delete-btn{font-size:11px; font-weight:600; color:#DC3545; background:#fff; border:1px solid #DC3545; border-radius:6px; padding:4px 10px; cursor:pointer;}
          .aihub-delete-btn:hover{background:#DC3545; color:#fff;}
        `}</style>

        <div className="aihub-root">
          <div className="aihub-main">
            <div className="aihub-crumb">
              Home &nbsp;&gt;&nbsp; Pro Test &nbsp;&gt;&nbsp; Projects &nbsp;&gt;&nbsp; <b>{pageTitle}</b>
            </div>

            <div className="aihub-topbar">
              <h1 className="aihub-pagetitle">{pageTitle}</h1>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div className="aihub-mode-toggle">
                  <span>Setup</span>
                  <div
                    className={"aihub-mode-switch" + (mode === "view" ? " on" : "")}
                    onClick={() => {
                      if (mode === "view") {
                        startCreate();
                      } else {
                        setMode("view");
                        setSelectedProjectId(null);
                      }
                    }}
                  >
                    <div className="aihub-mode-knob" style={{ left: mode === "view" ? 18 : 2 }} />
                  </div>
                  <span>View</span>
                </div>
              </div>
            </div>

            {/* ================= CREATE / SETUP WIZARD ================= */}
            {mode === "create" && (
              <>
                <div className="aihub-stepper">
                  {STEPS.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      <div
                        className={
                          "aihub-step" +
                          (i < current ? " done" : "") +
                          (i === current ? " current" : "")
                        }
                        onClick={() => setCurrent(i)}
                      >
                        <div className="circle">{i < current ? "OK" : i + 1}</div>
                        <div className="label">{s.label}</div>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={"aihub-connector" + (i < current ? " done" : "")} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="aihub-card">
                  {STEPS[current].key === "basic" && (
                    <>
                      <h3>Basic Information</h3>
                      <div className="hint">
                        Collect the core identity of the project. Shown throughout dashboards, reports, integrations and audit logs.
                      </div>
                      <div className="aihub-field">
                        <label>Project Name *</label>
                        <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                        />
                        <div className="aihub-helper">3-100 characters, unique within this Workplace.</div>
                      </div>
                      <div className="aihub-field">
                        <label>
                          Description <span style={{ fontWeight: 400, color: "var(--gray)" }}>(optional)</span>
                        </label>
                        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                      </div>
                      <div className="aihub-field">
                        <label>
                          Project Domain * <span style={{ fontWeight: 400, color: "var(--gray)" }}>- locked after creation</span>
                        </label>
                        <div className="aihub-domain-grid">
                          <div
                            className={"aihub-domain-card" + (selectedDomain === "Testing" ? " selected" : "")}
                            onClick={() => setSelectedDomain("Testing")}
                          >
                            <span className="aihub-badge-avail">Available</span>
                            <div className="emoji">Testing</div>
                            <div className="dname">Testing</div>
                            <div className="ddesc">AI-powered software testing & QA.</div>
                          </div>
                        </div>
                      </div>
                      <div className="aihub-field" style={{ marginBottom: 0 }}>
                        <label>Department *</label>
                        <div className="aihub-dept-pills">
                          {DEPARTMENTS.map((dept) => (
                            <div
                              key={dept}
                              className={"aihub-dept-pill" + (selectedDept === dept ? " active" : "")}
                              onClick={() => setSelectedDept(dept)}
                            >
                              {dept}
                            </div>
                          ))}
                        </div>
                        <div className="aihub-helper">
                          Which business unit this project belongs to - same grouping as the Workplace Home dashboard.
                        </div>
                      </div>
                    </>
                  )}

                  {STEPS[current].key === "target" && (
                    <>
                      <h3>Target Application</h3>
                      <div className="hint">Tells AIHUB which app to crawl, authenticate into, and monitor.</div>
                      <div className="aihub-field">
                        <label>Application URL *</label>
                        <input type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} />
                        <div className="aihub-helper">Must be a valid, reachable HTTPS URL.</div>
                      </div>
                      <div
                        className="aihub-field"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "12px 14px",
                        }}
                      >
                        <div>
                          <label style={{ margin: 0 }}>Authentication Required</label>
                          <div className="aihub-helper" style={{ marginTop: 2 }}>
                            If off, AIHUB starts crawling immediately.
                          </div>
                        </div>
                        <div
                          onClick={() => setAuthRequired(!authRequired)}
                          style={{
                            width: 38,
                            height: 20,
                            background: authRequired ? "var(--purple)" : "#D6D6D6",
                            borderRadius: 20,
                            position: "relative",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              background: "#fff",
                              borderRadius: "50%",
                              position: "absolute",
                              right: authRequired ? 2 : 20,
                              top: 2,
                              transition: "right 0.15s",
                            }}
                          />
                        </div>
                      </div>
                      <div className="aihub-field">
                        <label>Authentication Type</label>
                        <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
                          {AUTH_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="aihub-field" style={{ marginBottom: 0 }}>
                        <button className="aihub-int-btn outline" style={{ width: "auto", padding: "8px 16px" }}>
                          Test Connection
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="aihub-footer-nav">
                  <div className="aihub-footer-left">
                    <button className="aihub-btn ghost" onClick={goPrev} disabled={current === 0}>
                      Previous
                    </button>
                    <button
                      className="aihub-btn ghost"
                      onClick={() => {
                        setMode("view");
                        setSelectedProjectId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="aihub-footer-right">
                    <button className="aihub-btn ghost">Save Draft</button>
                    <button
                      className="aihub-btn primary"
                      onClick={() => {
                        if (current === STEPS.length - 1) {
                          const created = addProject({
                            name: projectName || "Untitled Project",
                            description,
                            domain: selectedDomain,
                            department: selectedDept,
                            workspace,
                            owner: "Divya K",
                            dateOfCreation: todayFormatted(),
                            applicationUrl: appUrl,
                            authRequired,
                            authType,
                            product: "AI Hub",
                            status: "Active",
                          });
                          setMode("view");
                          setSelectedProjectId(created.id);
                        } else {
                          goNext();
                        }
                      }}
                    >
                      {current === STEPS.length - 1 ? "Create Project" : "Next"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ================= PROJECT LIST (view mode, nothing selected) ================= */}
            {mode === "view" && !selectedProject && (
              <div className="aihub-card">
                <h3>All Projects</h3>
                <div className="hint">Click a project to view or edit its details.</div>

                {projects.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--gray)" }}>
                    No projects yet. Click &quot;+ New Project&quot; to create one.
                  </div>
                )}

                {projects.map((p) => (
                  <div key={p.id} className="aihub-list-row" onClick={() => setSelectedProjectId(p.id)}>
                    <div className="aihub-list-name">{p.name}</div>
                    <div className="aihub-list-meta">
                      <span className="aihub-badge domain">{p.domain}</span>
                      <span className="aihub-badge status">{p.status}</span>
                      <span className="aihub-list-date">{p.dateOfCreation}</span>
                      <button
                        type="button"
                        title="Delete project"
                        className="aihub-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${p.name}"? This cannot be undone.`)) {
                            deleteProject(p.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ================= PROJECT VIEW (a specific project selected) ================= */}
            {mode === "view" && selectedProject && (
              <>
                <button
                  className="aihub-back-link"
                  onClick={() => setSelectedProjectId(null)}
                >
                  &lt; Back to all projects
                </button>

                <div className="aihub-view-hero">
                  <div>
                    <div className="aihub-view-badges">
                      <span className="aihub-badge domain">{selectedProject.domain}</span>
                      <span className="aihub-badge dept">{selectedProject.department}</span>
                      <span className="aihub-badge status">{selectedProject.status}</span>
                    </div>
                    <div className="aihub-view-desc">{selectedProject.description}</div>
                  </div>
                </div>

                {/* Basic Information card */}
                <div className="aihub-card">
                  <div className="aihub-view-card-head">
                    <h3>Basic Information</h3>
                    {!editingBasic ? (
                      <button className="aihub-edit-link" onClick={() => setEditingBasic(true)}>
                        Edit
                      </button>
                    ) : null}
                  </div>

                  {!editingBasic ? (
                    <>
                      <div className="aihub-view-row">
                        <div className="k">Workspace</div>
                        <div className="v">{selectedProject.workspace}</div>
                      </div>
                      <div className="aihub-view-row">
                        <div className="k">Date of Creation</div>
                        <div className="v">{selectedProject.dateOfCreation}</div>
                      </div>
                      <div className="aihub-view-row">
                        <div className="k">Project Name</div>
                        <div className="v">{selectedProject.name}</div>
                      </div>
                      <div className="aihub-view-row">
                        <div className="k">Description</div>
                        <div className="v">{selectedProject.description}</div>
                      </div>
                      <div className="aihub-view-row">
                        <div className="k">Domain</div>
                        <div className="v">{selectedProject.domain} (locked)</div>
                      </div>
                      <div className="aihub-view-row">
                        <div className="k">Department</div>
                        <div className="v">{selectedProject.department}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="aihub-field">
                        <label>Workspace</label>
                        <input type="text" value={editWorkspace} onChange={(e) => setEditWorkspace(e.target.value)} />
                        <div className="aihub-helper">Date of Creation: {selectedProject.dateOfCreation} (fixed, not editable)</div>
                      </div>
                      <div className="aihub-field">
                        <label>Project Name *</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>
                      <div className="aihub-field">
                        <label>Description</label>
                        <textarea rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                      </div>
                      <div className="aihub-field" style={{ marginBottom: 0 }}>
                        <label>Department</label>
                        <div className="aihub-dept-pills">
                          {DEPARTMENTS.map((dept) => (
                            <div
                              key={dept}
                              className={"aihub-dept-pill" + (editDept === dept ? " active" : "")}
                              onClick={() => setEditDept(dept)}
                            >
                              {dept}
                            </div>
                          ))}
                        </div>
                        <div className="aihub-helper">Domain is locked after creation and can&apos;t be changed here.</div>
                      </div>
                      <div className="aihub-save-row">
                        <button className="aihub-btn ghost" onClick={() => setEditingBasic(false)}>
                          Cancel
                        </button>
                        <button className="aihub-btn primary" onClick={handleSaveBasic}>
                          Save Changes
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Target Application card */}
                <div className="aihub-card">
                  <div className="aihub-view-card-head">
                    <h3>Target Application</h3>
                    {!editingTarget ? (
                      <button className="aihub-edit-link" onClick={() => setEditingTarget(true)}>
                        Edit
                      </button>
                    ) : null}
                  </div>

                  {!editingTarget ? (
                    <>
                      <div className="aihub-view-row">
                        <div className="k">Application URL</div>
                        <div className="v">{selectedProject.applicationUrl || "-"}</div>
                      </div>
                      <div className="aihub-view-row">
                        <div className="k">Authentication Required</div>
                        <div className="v">{selectedProject.authRequired ? "Yes" : "No"}</div>
                      </div>
                      {selectedProject.authRequired && (
                        <div className="aihub-view-row">
                          <div className="k">Authentication Type</div>
                          <div className="v">{selectedProject.authType}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="aihub-field">
                        <label>Application URL *</label>
                        <input type="url" value={editAppUrl} onChange={(e) => setEditAppUrl(e.target.value)} />
                      </div>
                      <div
                        className="aihub-field"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "12px 14px",
                        }}
                      >
                        <label style={{ margin: 0 }}>Authentication Required</label>
                        <div
                          onClick={() => setEditAuthRequired(!editAuthRequired)}
                          style={{
                            width: 38,
                            height: 20,
                            background: editAuthRequired ? "var(--purple)" : "#D6D6D6",
                            borderRadius: 20,
                            position: "relative",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              background: "#fff",
                              borderRadius: "50%",
                              position: "absolute",
                              right: editAuthRequired ? 2 : 20,
                              top: 2,
                              transition: "right 0.15s",
                            }}
                          />
                        </div>
                      </div>
                      {editAuthRequired && (
                        <div className="aihub-field" style={{ marginBottom: 0 }}>
                          <label>Authentication Type</label>
                          <select value={editAuthType} onChange={(e) => setEditAuthType(e.target.value)}>
                            {AUTH_TYPES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="aihub-save-row">
                        <button className="aihub-btn ghost" onClick={() => setEditingTarget(false)}>
                          Cancel
                        </button>
                        <button className="aihub-btn primary" onClick={handleSaveTarget}>
                          Save Changes
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}


