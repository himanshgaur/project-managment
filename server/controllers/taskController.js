import prisma from "../configs/prisma.js";
import { clerkClient } from "@clerk/express";
import sendEmail from "../configs/nodemailer.js";

//create task

export const createTask = async (req, res) => {
    try{
        const{userId} = await req.auth();
        const {projectId, title, description, type, status, priority, assigneeId, due_date} = req.body;

        if (!assigneeId) {
            return res.status(400).json({ message: "An assignee is required" });
        }

        if (!due_date || Number.isNaN(new Date(due_date).getTime())) {
            return res.status(400).json({ message: "A valid due date is required" });
        }

        //check if user has admin role for project
        const project = await prisma.project.findUnique({
            where: {id: projectId},
            include: {members: {include: {user: true}}}
        })
        if(!project){
            return res.status(404).json({
                message: "project not found"
            })
        }

        if(project.team_lead !== userId){
            return res.status(403).json({message: "you don't have admin privileges for this project"});
        }

        const assignedMember = project.members.find((member) => member.user.id === assigneeId);
        if(!assignedMember){
            return res.status(403).json({
                message : "assignee is not a memeber of the project / workspace"
            });
        }

        const task = await prisma.task.create({
            data: {
                projectId,
                title,
                description,
                priority,
                assigneeId,
                status,
                type,
                due_date: new Date(due_date)
            }
        })

        const assignedClerkUser = await clerkClient.users.getUser(assigneeId);
        const assignedEmail = assignedClerkUser.emailAddresses[0]?.emailAddress || assignedMember.user.email;
        const assignedName = `${assignedClerkUser.firstName || ""} ${assignedClerkUser.lastName || ""}`.trim() || assignedEmail;

        await prisma.user.update({
            where: { id: assigneeId },
            data: {
                name: assignedName,
                email: assignedEmail,
                image: assignedClerkUser.imageUrl || "",
            },
        });

        const taskWithAssignee = await prisma.task.findUnique({
            where:{id: task.id},
            include:{ assignee: true}
        })
        res.json({task: taskWithAssignee, message: "Task created successfully"})

        sendEmail({
            to: taskWithAssignee.assignee.email,
            subject: `New Task Assignment in ${project.name}`,
            body: `<h2>Hi ${taskWithAssignee.assignee.name || taskWithAssignee.assignee.email},</h2>
                <p>You have been assigned a new task in <strong>${project.name}</strong>.</p>
                <p><strong>Task:</strong> ${task.title}</p>
                <p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>`,
        }).catch((error) => console.error("Task assignment email failed:", error));

    }catch (error){
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

//update task 
export const updateTask = async (req, res) => {
    try{

        const task = await prisma.task.findUnique({
            where: {id : req.params.id}
        })
        if(!task){
            return res.status(404).json({message: "Task not found"});
        }

        const{userId} = await req.auth();


        const project = await prisma.project.findUnique({
            where: {id: task.projectId},
            include: {members: {include: {user: true}}}
        })
        if(!project){
            return res.status(404).json({
                message: "project not found"
            })
        }

        const isProjectMember = project.members.some((member) => member.userId === userId);
        const requestedFields = Object.keys(req.body);

        if (!isProjectMember) {
            return res.status(403).json({message: "You are not a member of this project"});
        }

        if(project.team_lead !== userId && requestedFields.some((field) => field !== "status")){
            return res.status(403).json({message: "you don't have admin privileges for this project"});
        }

        const { assigneeId } = req.body;

        if(assigneeId && !project.members.find((member) => member.user.id === assigneeId)){
            return res.status(403).json({
                message : "assignee is not a memeber of the project / workspace"
            });
        }

        const allowedFields = ["title", "description", "type", "status", "priority", "assigneeId", "due_date"];
        const data = Object.fromEntries(
            Object.entries(req.body)
                .filter(([key, value]) => allowedFields.includes(key) && value !== undefined)
        );

        if (data.due_date) {
            data.due_date = new Date(data.due_date);
        }

        const updateTask = await prisma.task.update({
            where: {id: req.params.id},
            data,
            include: { assignee: true },
        })
        res.json({task: updateTask, message: "Task updated successfully"})

    }catch (error){
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}

//Delete
export const deleteTask = async (req, res) => {
    try{

        const{userId} = await req.auth();
        const {taskIds} = req.body;
        const tasks = await prisma.task.findMany({
            where:{id: {in: taskIds}}
        })

        if(tasks.length === 0){
            return res.status(404).json({message: "Task not found"});
        }

        if (tasks.some((task) => task.projectId !== tasks[0].projectId)) {
            return res.status(400).json({message: "Tasks must belong to the same project"});
        }

        
        const project = await prisma.project.findUnique({
            where: {id: tasks[0].projectId},
            include: {members: {include: {user: true}}}
        })
        if(!project){
            return res.status(404).json({
                message: "project not found"
            })
        }else if(project.team_lead !== userId){
            return res.status(403).json({message: "you don't have admin privileges for this project"});
        }

        await prisma.task.deleteMany({
            where: {id:{in: taskIds}}
        })
        res.json({message: "Task deleted successfully"})

    }catch (error){
        console.log(error);
        res.status(500).json({message: error.code || error.message});
    }
}