"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import SupabaseSetup from "@/components/supabase-setup";
import { supabase } from "@/lib/supabase";
import type { Note, Task } from "@/types";

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Could not connect to your workspace. Please try again.";
}

export default function Dashboard() {
  return supabase ? <AuthenticatedDashboard client={supabase} /> : <SupabaseSetup />;
}

function AuthenticatedDashboard({ client }: { client: SupabaseClient }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let authVersion = 0;
    const initialVersion = authVersion;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      authVersion += 1;
      if (!active) return;
      setUser(session?.user ?? null);
      if (session) setAuthError(null);
      if (!session) router.replace("/login");
    });

    void client.auth.getUser().then(({ data, error }) => {
      if (!active || authVersion !== initialVersion) return;
      if (error && error.name !== "AuthSessionMissingError") {
        setAuthError(error.message);
      } else if (!data.user) {
        router.replace("/login");
      } else {
        setUser(data.user);
      }
    }).catch((error: unknown) => {
      if (active && authVersion === initialVersion) setAuthError(errorMessage(error));
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [client, router]);

  if (authError) return <main className="p-8 text-center"><p role="alert">{authError}</p><button className="mt-4 text-blue-600 underline" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!user) return <main className="p-8 text-center" role="status">Loading your workspace...</main>;
  return <UserDashboard key={user.id} client={client} user={user} />;
}

function UserDashboard({ client, user }: { client: SupabaseClient; user: User }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");
  const [taskTitle, setTaskTitle] = useState("");
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editedTaskTitle, setEditedTaskTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const requestVersion = useRef(0);
  const mutationPending = useRef(false);
  const active = useRef(true);

  const refreshData = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [tasksResult, notesResult] = await Promise.all([
        client.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        client.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (!active.current || version !== requestVersion.current) return;
      if (tasksResult.error) throw tasksResult.error;
      if (notesResult.error) throw notesResult.error;
      setTasks(tasksResult.data ?? []);
      setNotes(notesResult.data ?? []);
      setLoaded(true);
      setError(null);
    } catch (refreshError: unknown) {
      if (active.current && version === requestVersion.current) {
        setError(errorMessage(refreshError));
      }
    }
  }, [client, user.id]);

  useEffect(() => {
    active.current = true;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && !mutationPending.current) void refreshData();
    };
    const initialRefresh = window.setTimeout(refreshWhenVisible, 0);
    let channel = client.channel(`workspace:${user.id}`);
    for (const table of ["tasks", "notes"]) {
      for (const event of ["INSERT", "UPDATE"] as const) {
        channel = channel.on("postgres_changes", {
          event, schema: "public", table, filter: `user_id=eq.${user.id}`,
        }, refreshWhenVisible);
      }
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") refreshWhenVisible();
    });
    // Periodic refresh also covers deletes and projects without Realtime enabled.
    const timer = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active.current = false;
      requestVersion.current += 1;
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void client.removeChannel(channel);
    };
  }, [client, user.id, refreshData]);

  const mutate = async (operation: () => Promise<void>) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    requestVersion.current += 1;
    setSaving(true);
    setError(null);
    try {
      await operation();
      await refreshData();
    } catch (mutationError: unknown) {
      if (active.current) setError(errorMessage(mutationError));
    } finally {
      mutationPending.current = false;
      if (active.current) setSaving(false);
    }
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    void mutate(async () => {
      const result = await client.from("tasks").insert({ user_id: user.id, title }).select().single();
      if (result.error) throw result.error;
      if (!active.current) return;
      setTasks((current) => [result.data, ...current]);
      setTaskTitle("");
    });
  };

  const saveTask = (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const title = editedTaskTitle.trim();
    if (!title) return;
    void mutate(async () => {
      const result = await client.from("tasks").update({ title }).eq("id", id).eq("user_id", user.id).select().single();
      if (result.error) throw result.error;
      if (!active.current) return;
      setTasks((current) => current.map((task) => task.id === id ? result.data : task));
      setEditingTask(null);
    });
  };

  const toggleTask = (task: Task) => void mutate(async () => {
    const result = await client.from("tasks").update({ is_completed: !task.is_completed }).eq("id", task.id).eq("user_id", user.id).select().single();
    if (result.error) throw result.error;
    if (active.current) setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
  });

  const deleteTask = (id: string) => void mutate(async () => {
    const result = await client.from("tasks").delete().eq("id", id).eq("user_id", user.id).select("id").single();
    if (result.error) throw result.error;
    if (active.current) setTasks((current) => current.filter((task) => task.id !== id));
  });

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = noteTitle.trim();
    if (!title) return;
    void mutate(async () => {
      const result = editingNote
        ? await client.from("notes").update({ title, content: noteContent }).eq("id", editingNote).eq("user_id", user.id).select().single()
        : await client.from("notes").insert({ user_id: user.id, title, content: noteContent }).select().single();
      if (result.error) throw result.error;
      if (!active.current) return;
      setNotes((current) => editingNote ? current.map((note) => note.id === editingNote ? result.data : note) : [result.data, ...current]);
      setEditingNote(null);
      setNoteTitle("");
      setNoteContent("");
    });
  };

  const deleteNote = (id: string) => void mutate(async () => {
    const result = await client.from("notes").delete().eq("id", id).eq("user_id", user.id).select("id").single();
    if (result.error) throw result.error;
    if (!active.current) return;
    setNotes((current) => current.filter((note) => note.id !== id));
    if (editingNote === id) { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }
  });

  const signOut = async () => {
    if (mutationPending.current) return;
    setSaving(true);
    try {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
    } catch (signOutError: unknown) {
      if (active.current) { setError(errorMessage(signOutError)); setSaving(false); }
    }
  };

  const visibleNotes = notes.filter((note) => `${note.title} ${note.content ?? ""}`.toLowerCase().includes(noteSearch.toLowerCase()));
  const button = "rounded-md px-3 py-2 text-sm disabled:opacity-50";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-blue-600">AI Productivity Hub</h1>
        <button disabled={saving} onClick={() => void signOut()} className={`${button} text-gray-600`}>Sign out</button>
      </header>
      <main className="mx-auto mt-6 max-w-4xl p-4">
        <div className="mb-6 flex flex-wrap items-center gap-4 border-b pb-3">
          <button aria-pressed={activeTab === "tasks"} className={activeTab === "tasks" ? "font-semibold text-blue-600" : "text-gray-600"} onClick={() => setActiveTab("tasks")}>Tasks</button>
          <button aria-pressed={activeTab === "notes"} className={activeTab === "notes" ? "font-semibold text-blue-600" : "text-gray-600"} onClick={() => setActiveTab("notes")}>Notes</button>
          <button disabled={saving} className={`${button} ml-auto text-blue-600`} onClick={() => void refreshData()}>Refresh</button>
        </div>
        {error && <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</div>}
        {saving && <p role="status" className="mb-3 text-sm text-gray-600">Saving...</p>}
        {!loaded && <p role="status" className="py-6 text-center">{error ? "Your data could not be loaded. Use Refresh to try again." : "Loading tasks and notes..."}</p>}
        {loaded && activeTab === "tasks" && (
          <section aria-label="Tasks">
            <form onSubmit={addTask} className="mb-6 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="new-task">New task</label>
              <input id="new-task" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} disabled={saving} placeholder="What needs to be done?" required className="min-w-0 flex-1 rounded-md border p-2" />
              <button disabled={saving || !taskTitle.trim()} className={`${button} bg-blue-600 text-white`}>Add</button>
            </form>
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-md border bg-white p-3">
                  <input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.is_completed} disabled={saving} onChange={() => toggleTask(task)} className="h-5 w-5" />
                  {editingTask === task.id ? (
                    <form onSubmit={(event) => saveTask(event, task.id)} className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <input aria-label="Task title" value={editedTaskTitle} onChange={(event) => setEditedTaskTitle(event.target.value)} disabled={saving} required className="min-w-0 flex-1 rounded border p-2" />
                      <button disabled={saving || !editedTaskTitle.trim()} className={`${button} text-blue-600`}>Save</button>
                      <button type="button" disabled={saving} className={button} onClick={() => setEditingTask(null)}>Cancel</button>
                    </form>
                  ) : <span className={`min-w-0 flex-1 break-words ${task.is_completed ? "text-gray-400 line-through" : ""}`}>{task.title}</span>}
                  <button disabled={saving} className={`${button} text-blue-600`} onClick={() => { setEditingTask(task.id); setEditedTaskTitle(task.title); }}>Edit</button>
                  <button disabled={saving} onClick={() => deleteTask(task.id)} className={`${button} text-red-600`}>Delete</button>
                </li>
              ))}
            </ul>
            {tasks.length === 0 && <p className="py-8 text-center text-gray-500">No tasks yet.</p>}
          </section>
        )}
        {loaded && activeTab === "notes" && (
          <section aria-label="Notes">
            <form onSubmit={saveNote} className="mb-6 rounded-md border bg-white p-4">
              <h2 className="mb-3 font-semibold">{editingNote ? "Edit note" : "New note"}</h2>
              <label className="sr-only" htmlFor="note-title">Note title</label>
              <input id="note-title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} disabled={saving} placeholder="Note title" required className="mb-3 w-full rounded-md border p-2" />
              <label className="sr-only" htmlFor="note-content">Note content</label>
              <textarea id="note-content" value={noteContent} onChange={(event) => setNoteContent(event.target.value)} disabled={saving} placeholder="Write your note here..." className="mb-3 h-32 w-full rounded-md border p-2" />
              <div className="flex gap-2">
                <button disabled={saving || !noteTitle.trim()} className={`${button} bg-blue-600 text-white`}>{editingNote ? "Save changes" : "Save note"}</button>
                {editingNote && <button type="button" disabled={saving} className={button} onClick={() => { setEditingNote(null); setNoteTitle(""); setNoteContent(""); }}>Cancel</button>}
              </div>
            </form>
            <label className="sr-only" htmlFor="note-search">Search notes</label>
            <input id="note-search" type="search" value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Search notes..." className="mb-4 w-full rounded-md border bg-white p-2" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleNotes.map((note) => (
                <article key={note.id} className="min-w-0 rounded-md border bg-white p-4">
                  <h3 className="mb-2 break-words text-lg font-bold">{note.title}</h3>
                  <p className="whitespace-pre-wrap break-words text-gray-700">{note.content}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">{new Date(note.created_at).toLocaleDateString()}</span>
                    <div className="flex gap-2">
                      <button disabled={saving} className={`${button} text-blue-600`} onClick={() => { setEditingNote(note.id); setNoteTitle(note.title); setNoteContent(note.content ?? ""); }}>Edit</button>
                      <button disabled={saving} className={`${button} text-red-600`} onClick={() => deleteNote(note.id)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visibleNotes.length === 0 && <p className="py-8 text-center text-gray-500">{notes.length ? "No matching notes." : "No notes yet."}</p>}
          </section>
        )}
      </main>
    </div>
  );
}
