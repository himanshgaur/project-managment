// import { Inngest } from "inngest";
// import prisma from "../configs/prisma.js";

// // Create a client to send and receive events
// export const inngest = new Inngest({ id: "project-management" });

// //Inngest function to save user data to a database
// const syncUserCreation = inngest.createFunction(
//     {id: 'sync-user-from-clerk'},
//     {event: 'clerk/user.created'},

//     async ({ event }) => {
//         const {data} = event;
//         await prisma.user.create({
//             data:{
//                 id: data.id,
//                 email: data?.email_addresses[0]?.email_address,
//                 name: data?.first_name + " " + data?.last_name,
//                 image: data?.image_url,

//             }
//         })
//     }
// )

// //Inngest function to delete user data from a database
// const syncUserDeletion = inngest.createFunction(
//     {id: 'sync-user-from-clerk'},
//     {event: 'clerk/user.deleted'},

//     async ({ event }) => {
//         const {data} = event;
//         await prisma.user.delete({
//             where:{
//                 id: data.id,
//             }
//         })
//     }
// )


// //Inngest function to update user data in a database
// const syncUserUpdation = inngest.createFunction(
//     {id: 'sync-user-from-clerk'},
//     {event: 'clerk/user.updated'},

//     async ({ event }) => {
//         const {data} = event;
//         await prisma.user.update({
//             where: {
//                 id: data.id
//             },
//             data:{
//                 email: data?.email_addresses[0]?.email_address,
//                 name: data?.first_name + " " + data?.last_name,
//                 image: data?.image_url,

//             }
//         })
//     }
// )


// // Create an empty array where we'll export future Inngest functions
// export const functions = [ syncUserCreation, syncUserDeletion, syncUserUpdation];

import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

// Create Inngest client
export const inngest = new Inngest({
    id: "project-management",
});

// Sync user creation
const syncUserCreation = inngest.createFunction(
    {
        id: "sync-user-creation",
        triggers: [
            {
                event: "clerk/user.created",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses?.[0]?.email_address,
                name: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
                image: data?.image_url,
            },
        });
    }
);

// Sync user deletion
const syncUserDeletion = inngest.createFunction(
    {
        id: "sync-user-deletion",
        triggers: [
            {
                event: "clerk/user.deleted",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.delete({
            where: {
                id: data.id,
            },
        });
    }
);

// Sync user update
const syncUserUpdation = inngest.createFunction(
    {
        id: "sync-user-updation",
        triggers: [
            {
                event: "clerk/user.updated",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses?.[0]?.email_address,
                name: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
                image: data?.image_url,
            },
        });
    }
);

// Export Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
];