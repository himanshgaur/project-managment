// import { useState, useEffect } from 'react'
// import Navbar from '../components/Navbar'
// import Sidebar from '../components/Sidebar'
// import { Outlet } from 'react-router-dom'
// import { useDispatch, useSelector } from 'react-redux'
// import { loadTheme } from '../features/themeSlice'
// import { Loader2Icon } from 'lucide-react'
// import {useUser, SignIn, useAuth, CreateOrganization} from '@clerk/react'
// import { fetchWorkspaces } from '../features/workspaceSlice'

// const Layout = () => {
//     const [isSidebarOpen, setIsSidebarOpen] = useState(false)
//     const { loading, workspaces } = useSelector((state) => state.workspace)
//     const dispatch = useDispatch()
//     const { user, isLoaded} = useUser()
//     const {getToken} = useAuth()

//     // Initial load of theme
//     useEffect(() => {
//         dispatch(loadTheme())
//     }, [])

//     //Initial load of workspaces
//     useEffect(()=>{ if(isLoaded && user && workspaces.length === 0){
//         dispatch(fetchWorkspaces({getToken}))
//     }}, [user, isLoaded])


//     if(!user){
//         return (
//             <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
//                 <SignIn />
//             </div>
//         )
//     }

//     if (loading) return (
//         <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
//             <Loader2Icon className="size-7 text-blue-500 animate-spin" />
//         </div>
//     )

//     if(user && workspaces.length === 0){
//         return (
//             <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
//                 <CreateOrganization />
//             </div>
//         )
//     }

//     return (
//         <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
//             <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
//             <div className="flex-1 flex flex-col h-screen">
//                 <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
//                 <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
//                     <Outlet />
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default Layout

import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loadTheme } from "../features/themeSlice";
import { Loader2Icon } from "lucide-react";
import {
    useUser,
    SignIn,
    useAuth,
    CreateOrganization,
    useOrganization,
    useOrganizationList,
} from "@clerk/react";
import { fetchWorkspaces } from "../features/workspaceSlice";

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { loading, initialized, workspaces } = useSelector(
        (state) => state.workspace
    );

    const dispatch = useDispatch();

    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const { organization } = useOrganization();
    const { userMemberships, isLoaded: organizationsLoaded, setActive } =
        useOrganizationList({ userMemberships: true });
    const [organizationReady, setOrganizationReady] = useState(false);

    // Load theme
    useEffect(() => {
        dispatch(loadTheme());
    }, [dispatch]);

    // Select the user's organization automatically. Workspace switching is
    // intentionally disabled in the logged-in dashboard.
    useEffect(() => {
        if (!isLoaded || !user || !organizationsLoaded) return;

        if (organization || userMemberships.data?.length === 0) {
            setOrganizationReady(true);
            return;
        }

        const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
        const membership = userMemberships.data.find(
            ({ organization: membershipOrganization }) =>
                membershipOrganization?.id === savedWorkspaceId
        ) || userMemberships.data[0];

        if (!membership?.organization?.id) return;

        setActive({ organization: membership.organization.id })
            .then(() => setOrganizationReady(true))
            .catch((error) => console.error("Failed to select organization:", error));
    }, [
        isLoaded,
        user,
        organization,
        organizationsLoaded,
        userMemberships.data,
        setActive,
    ]);

    // Fetch workspaces after Clerk has selected the organization.
    useEffect(() => {
        if (!isLoaded || !user || !organizationReady) return;

        dispatch(fetchWorkspaces({ getToken }));
    }, [isLoaded, user, organizationReady, getToken, dispatch]);

    // Clerk creates the organization first and the backend syncs it through
    // Inngest. Refresh until that sync is visible so the dashboard opens
    // automatically after organization creation.
    useEffect(() => {
        if (!isLoaded || !user || !organizationReady || !initialized || workspaces.length > 0) return;

        const interval = setInterval(() => {
            dispatch(fetchWorkspaces({ getToken }));
        }, 1500);

        return () => clearInterval(interval);
    }, [isLoaded, user, organizationReady, initialized, workspaces.length, getToken, dispatch]);

    // User not loaded yet
    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    // User not signed in
    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <SignIn />
            </div>
        );
    }

    // Loading workspaces
    if (loading || !initialized || !organizationsLoaded || !organizationReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    // No workspace yet
    const hasClerkOrganization = Boolean(
        organization || userMemberships.data?.length
    );

    if (workspaces.length === 0 && hasClerkOrganization) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (workspaces.length === 0 && !hasClerkOrganization) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
                <CreateOrganization
                    afterCreateOrganizationUrl="/"
                    skipInvitationScreen={true}
                />
            </div>
        );
    }

    // Dashboard
    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
            />

            <div className="flex-1 flex flex-col h-screen">
                <Navbar
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                />

                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;