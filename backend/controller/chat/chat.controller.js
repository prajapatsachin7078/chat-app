import { Chat } from "../../models/chat.model.js";
import { User } from "../../models/user.model.js";

export const accessChat = async (req, res) => {
    const { userId } = req.body; // getting the receiver id from the sender who wants to initiate the chat
    const currentUserId = req.userId;
    if(!userId){
        return res.status(400).json({
            message: "Chat can't be created. Please give participant!"
        })
    }

    try {
        const existingChat = await Chat.find({
            isGroupChat: false,
            $and: [
                { participants: { $elemMatch: { $eq: currentUserId } } },
                { participants: { $elemMatch: { $eq: userId } } }
            ]
        })
            .populate('participants', '-password')
            .populate('lastMessage');

        const populatedChat = await User.populate(existingChat, {
            path: 'lastMessage.sender',
            select: 'name email avatar'
        });

        if (populatedChat.length > 0) {
            return res.status(200).json(populatedChat[0]);
        } else {
            const chatData = {
                name: 'sender',
                isGroupChat: false,
                participants: [currentUserId, userId]
            };
            const chat = await Chat.create(chatData);
            const fullChat = await Chat.findOne({ _id: chat._id })
                .populate('participants', '-password')
                .populate('lastMessage');
            return res.status(201).json(fullChat);
        }
    } catch (error) {
        console.error("Error accessing chat: ", error);
        return res.status(500).json({ message: "Internal server error." });
    }
}

export const fetchChats = async (req, res) => {
    try {
        const allChats = await Chat.find({ participants: { $elemMatch: { $eq: req.userId } } })
            .populate({
                path: 'lastMessage',
                populate: {
                    path: 'sender',
                    select: 'name email avatar'
                }
            })
            .populate('participants', '-password')
            .populate('admin', '-password')
            .sort({ updatedAt: -1 });

        return res.status(200).json({ populatedChats: allChats, currentUserId: req.userId });
    } catch (error) {
        console.error("Fetch Chats: ", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const createGroup = async (req, res) => {
    const userId = req.userId;
    const { name, participants } = req.body;

    try {
        // Ensure participants is an array
        if (!Array.isArray(participants)) {
            return res.status(400).json({ message: "Participants must be an array." });
        }

        // Check if the same name group already exists
        const isGroupExist = await Chat.findOne({ name });
        if (isGroupExist) {
            return res.status(400).json({ message: "Group name already exists. Try a different one." });
        }

        // Create group
        const group = await Chat.create({
            name,
            isGroupChat: true,
            participants: [...participants, userId],
            admin: userId
        });

        const chatGroup = await Chat.findById(group._id)
            .populate('participants', '-password')
            .populate('admin', '-password');

        return res.status(201).json(chatGroup || { message: "Group couldn't be created! Try again!" });
    } catch (error) {
        console.error('Error in creating group: ', error);
        return res.status(500).json({ message: "Internal server error." });
    }
}

export const renameGroup = async (req, res) => {
    const { newName, groupId } = req.params
    try {
        const group = await Chat.findByIdAndUpdate(
            groupId,
            { name: newName },
            { new: true }
        );
        
        // Fetch the updated group
        const chatGroup = await Chat.findById(groupId)
            .populate('participants', '-password')
            .populate('admin', '-password');
        return chatGroup
            ? res.status(200).json( chatGroup )
            : res.status(400).json({ message: "Group couldn't be renamed. Try again!" });
    } catch (error) {
        console.error("Error while renaming: ", error);
        return res.status(500).json({ message: "Internal server error." });
    }
}

export const removeGroup = async (req, res) => {
    const groupId = req.params.groupId;
    try {
        const group = await Chat.findByIdAndDelete(groupId);

        return group
            ? res.status(200).json({ message: "Group Deleted!" })
            : res.status(404).json({ message: "Group not found!" });
    } catch (error) {
        console.error("Error while deleting: ", error);
        return res.status(500).json({ message: "Internal server issue! Try again!" });
    }
}

export const removeFromGroup = async (req, res) => {
    const { groupId, memberId } = req.params;

    try {
        const group = await Chat.findByIdAndUpdate(groupId,
            { $pull: { participants: memberId } },
            { new: true }
        );

        if (!group) {
            return res.status(404).json({ message: "Group not found!" });
        }

        // Fetch and populate the updated group
        const chatGroup = await Chat.findById(groupId)
            .populate('participants', '-password')
            .populate('admin', '-password');

        return res.status(200).json({ message: "Member removed successfully!", chatGroup });
    } catch (error) {
        console.error("Error while removing member: ", error);
        return res.status(500).json({ message: "Internal server issue! Please try again!" });
    }
}

export const leaveGroup = async (req, res) => {
    const { groupId } = req.params;
    const { userId } = req;

    try {
        // Fetch the group by ID
        const group = await Chat.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if the user is a participant of the group
        if (!group.participants.includes(userId)) {
            return res.status(403).json({ message: "You are not a participant in this group" });
        }

        // If the user is the admin, transfer admin rights to another participant
        if (group.admin.toString() === userId) {
            if (group.participants.length > 1) {
                // Assign admin to the next participant 
                const newAdmin = group.participants.find(participant => participant.toString() !== userId);
                group.admin = newAdmin;
            } else {
                // If there's only one participant (the admin)
                return res.status(400).json({ message: "Admin cannot leave as the only participant" });
            }
        }

        // Remove the user from the group participants list
        group.participants = group.participants.filter(participant => participant.toString() !== userId);

        // Save the updated group
        await group.save();

        return res.status(200).json({ message: "You have left the group successfully", group });
    } catch (error) {
        console.error("Error leaving group:", error);
        return res.status(500).json({ message: "An error occurred", error });
    }
};


export const addToGroup = async (req, res) => {
    const { groupId, memberId } = req.params;

    try {
        const group = await Chat.findByIdAndUpdate(groupId,
            { $addToSet: { participants: memberId } },
            { new: true }
        );
        const chatGroup = await Chat.findById(groupId)
            .populate('participants','-password')
            .populate('admin','-password');

        return chatGroup
            ? res.status(200).json({ 
                chatGroup 
            })
            : res.status(404).json({ 
                message: "Group not found!" 
            });
    } catch (error) {
        console.error("Error while adding member: ", error);
        return res.status(500).json({ 
            message: "Internal server issue! Please try again!" 
        });
    }
}
