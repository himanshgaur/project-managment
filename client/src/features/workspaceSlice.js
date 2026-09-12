import { createSlice } from "@reduxjs/toolkit";
import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../configs/api";

// export const fetchWorkspaces = createAsyncThunk("workspace/fetchWorkspaces", async ({getToken}) => {
//     try{
//         const {data} = await api.get('/api/workspaces', {headers: {Authorization: `Bearer ${await getToken()}` }})
//         return data.workspaces || []
//     }catch(error){
//         console.error(error?.response?.data?.message || error.message);
//         return [];

//     }
// });

export const fetchWorkspaces = createAsyncThunk(
    "workspace/fetchWorkspaces",
    async ({ getToken }, { rejectWithValue }) => {
        try {
            const token = await getToken();

            console.log("Fetching workspaces...");

            const { data } = await api.get("/api/workspaces", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            console.log("WORKSPACE API RESPONSE:", data);

            return data.workspaces || [];
        } catch (error) {
            console.error(
                "WORKSPACE API ERROR:",
                error?.response?.data || error.message
            );

            return rejectWithValue(
                error?.response?.data?.message || error.message
            );
        }
    },
    {
        condition: (_, { getState }) => !getState().workspace.loading,
    }
);

const initialState = {
    workspaces: [],
    currentWorkspace:null,
    loading: false,
    initialized: false,
};

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        setWorkspaces: (state, action) => {
            state.workspaces = action.payload;
        },
        setCurrentWorkspace: (state, action) => {
            if (action.payload) {
                localStorage.setItem("currentWorkspaceId", action.payload);
            } else {
                localStorage.removeItem("currentWorkspaceId");
            }
            state.currentWorkspace = state.workspaces.find((w) => w.id === action.payload);
        },
        addWorkspace: (state, action) => {
            state.workspaces.push(action.payload);

            // set current workspace to the new workspace
            if (state.currentWorkspace?.id !== action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        updateWorkspace: (state, action) => {
            state.workspaces = state.workspaces.map((w) =>
                w.id === action.payload.id ? action.payload : w
            );

            // if current workspace is updated, set it to the updated workspace
            if (state.currentWorkspace?.id === action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        // deleteWorkspace: (state, action) => {
        //     state.workspaces = state.workspaces.filter((w) => w._id !== action.payload);
        // },
        deleteWorkspace: (state, action) => {
    state.workspaces = state.workspaces.filter(
        (w) => w.id !== action.payload
    );
},
        addProject: (state, action) => {
            state.currentWorkspace.projects.push(action.payload);
            // find workspace by id and add project to it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? { ...w, projects: w.projects.concat(action.payload) } : w
            );
        },
        addTask: (state, action) => {
            const projectId = action.payload.projectId;

            state.workspaces = state.workspaces.map((workspace) => {
                if (workspace.id !== state.currentWorkspace?.id) {
                    return workspace;
                }

                return {
                    ...workspace,
                    projects: workspace.projects.map((project) =>
                        project.id === projectId
                            ? { ...project, tasks: [...project.tasks, action.payload] }
                            : project
                    ),
                };
            });

            state.currentWorkspace = state.workspaces.find(
                (workspace) => workspace.id === state.currentWorkspace?.id
            );
        },
        updateTask: (state, action) => {
            state.currentWorkspace.projects.map((p) => {
                if (p.id === action.payload.projectId) {
                    p.tasks = p.tasks.map((t) =>
                        t.id === action.payload.id ? action.payload : t
                    );
                }
            });
            // find workspace and project by id and update task in it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? {
                            ...p, tasks: p.tasks.map((t) =>
                                t.id === action.payload.id ? action.payload : t
                            )
                        } : p
                    )
                } : w
            );
        },
        deleteTask: (state, action) => {
            const taskIds = action.payload;
            state.currentWorkspace.projects.forEach((p) => {
                p.tasks = p.tasks.filter((t) => !taskIds.includes(t.id));
            });

            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w,
                    projects: w.projects.map((p) => ({
                        ...p,
                        tasks: p.tasks.filter((t) => !taskIds.includes(t.id)),
                    }))
                } : w
            );

            state.currentWorkspace = state.workspaces.find(
                (w) => w.id === state.currentWorkspace.id
            );
        }

    },
    extraReducers: (builder) => {
        builder.addCase(fetchWorkspaces.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
            state.workspaces = action.payload;
            if(action.payload.length > 0){
                const localStorageWorkspaceId = localStorage.getItem("currentWorkspaceId");
                if(localStorageWorkspaceId){
                    const findWorkspace = action.payload.find((w) => w.id === localStorageWorkspaceId);
                    if(findWorkspace){
                        state.currentWorkspace = findWorkspace;
                    }else{
                        state.currentWorkspace = action.payload[0];
                    }

                }else{
                    state.currentWorkspace = action.payload[0];
                }
            }
            state.loading = false;
            state.initialized = true;
        });
        builder.addCase(fetchWorkspaces.rejected, (state) => {
            state.loading = false;
            state.initialized = true;
        });
    }
});

export const { setWorkspaces, setCurrentWorkspace, addWorkspace, updateWorkspace, deleteWorkspace, addProject, addTask, updateTask, deleteTask } = workspaceSlice.actions;
export default workspaceSlice.reducer;