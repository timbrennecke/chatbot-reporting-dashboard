import { Conversation, ThreadsResponse, AttributesResponse, BulkAttributesResponse } from './types';

export const mockConversation: Conversation = {
  "id": "01990f50-2c0a-76ff-8d8d-d13648d6bb15",
  "title": "Welcome to CHECK24",
  "createdAt": "2025-09-03T11:22:17.957Z",
  "lastMessageAt": "2025-09-03T11:25:31.143Z",
  "messages": [
    {
      "id": "01990f50-3c19-71a4-909b-9d15b6485d82",
      "role": "assistant",
      "content": [
        {
          "kind": "text",
          "content": "Welcome to CHECK24! How can I help you today?"
        },
        {
          "kind": "ui",
          "ui": {
            "interactive": true,
            "final": false,
            "kind": "web-component",
            "customUiInstanceId": "welcome-card-1",
            "namespace": "home",
            "identifier": "welcome-card",
            "state": { "step": 1 },
            "initialState": { "step": 1 }
          }
        }
      ],
      "sentAt": "2025-09-03T11:22:20.569Z"
    },
    {
      "id": "01990f50-3c19-71a4-909b-9d15b6485d83",
      "role": "user",
      "content": [
        {
          "kind": "text",
          "content": "I'm looking for internet packages"
        }
      ],
      "sentAt": "2025-09-03T11:23:45.123Z"
    },
    {
      "id": "01990f50-3c19-71a4-909b-9d15b6485d84",
      "role": "assistant",
      "content": [
        {
          "kind": "text",
          "content": "Great! I can help you find the best internet package for your needs."
        },
        {
          "kind": "linkout",
          "url": "https://www.check24.de/internet",
          "text": "View all internet packages"
        },
        {
          "kind": "ui",
          "ui": {
            "interactive": true,
            "final": true,
            "kind": "form-component",
            "customUiInstanceId": "internet-form-1",
            "namespace": "internet",
            "identifier": "package-selector",
            "state": { "selected": null },
            "initialState": { "selected": null }
          }
        }
      ],
      "sentAt": "2025-09-03T11:25:31.143Z"
    }
  ],
  "threadIds": [
    "home/01990f50-31de-72fd-89a6-d08b5b3d9a8f",
    "internet/01990f50-31de-72fd-89a6-d08b5b3d9a8e"
  ]
};

export const mockThreadsResponse: ThreadsResponse = {
  "threads": [
    {
      "thread": {
        "id": "home/01990f50-31de-72fd-89a6-d08b5b3d9a8f",
        "conversationId": "01990f50-2c0a-76ff-8d8d-d13648d6bb15",
        "createdAt": "2025-09-03T11:22:17.957Z",
        "messages": [
          {
            "id": "01990f50-3c19-71a4-909b-9d15b6485d82",
            "role": "assistant",
            "content": [
              {
                "kind": "text",
                "content": "Welcome to CHECK24! How can I help you today?"
              },
              {
                "kind": "ui",
                "ui": {
                  "interactive": true,
                  "final": false,
                  "kind": "web-component",
                  "customUiInstanceId": "welcome-card-1",
                  "namespace": "home",
                  "identifier": "welcome-card",
                  "state": { "step": 1 },
                  "initialState": { "step": 1 }
                }
              }
            ],
            "sentAt": "2025-09-03T11:22:20.569Z"
          }
        ]
      }
    },
    {
      "thread": {
        "id": "internet/01990f50-31de-72fd-89a6-d08b5b3d9a8e",
        "conversationId": "01990f50-2c0a-76ff-8d8d-d13648d6bb15",
        "createdAt": "2025-09-03T11:23:45.123Z",
        "messages": [
          {
            "id": "01990f50-3c19-71a4-909b-9d15b6485d83",
            "role": "user",
            "content": [
              {
                "kind": "text",
                "content": "I'm looking for internet packages"
              }
            ],
            "sentAt": "2025-09-03T11:23:45.123Z"
          },
          {
            "id": "01990f50-3c19-71a4-909b-9d15b6485d84",
            "role": "assistant",
            "content": [
              {
                "kind": "text",
                "content": "Great! I can help you find the best internet package for your needs."
              },
              {
                "kind": "linkout",
                "url": "https://www.check24.de/internet",
                "text": "View all internet packages"
              },
              {
                "kind": "ui",
                "ui": {
                  "interactive": true,
                  "final": true,
                  "kind": "form-component",
                  "customUiInstanceId": "internet-form-1",
                  "namespace": "internet",
                  "identifier": "package-selector",
                  "state": { "selected": null },
                  "initialState": { "selected": null }
                }
              }
            ],
            "sentAt": "2025-09-03T11:25:31.143Z"
          }
        ]
      }
    },
    {
      "thread": {
        "id": "mobile/01990f50-31de-72fd-89a6-d08b5b3d9a8d",
        "conversationId": "01990f50-2c0a-76ff-8d8d-d13648d6bb16",
        "createdAt": "2025-09-03T14:15:30.000Z",
        "messages": [
          {
            "id": "01990f50-3c19-71a4-909b-9d15b6485d85",
            "role": "assistant",
            "content": [
              {
                "kind": "text",
                "content": "Looking for a mobile plan? Let me help you compare options."
              }
            ],
            "sentAt": "2025-09-03T14:15:30.000Z"
          },
          {
            "id": "01990f50-3c19-71a4-909b-9d15b6485d86",
            "role": "user",
            "content": [
              {
                "kind": "text",
                "content": "Yes, I need unlimited data"
              }
            ],
            "sentAt": "2025-09-03T14:16:45.000Z"
          }
        ]
      }
    },
    {
      "thread": {
        "id": "tools/01990f50-31de-72fd-89a6-d08b5b3d9a8c",
        "conversationId": "01990f50-2c0a-76ff-8d8d-d13648d6bb17",
        "createdAt": "2025-09-03T15:20:00.000Z",
        "messages": [
          {
            "id": "system-tool-msg-1",
            "role": "system",
            "content": [
              {
                "kind": "text",
                "content": "**Tool Name:** `search_database`\n**Description:** Searching customer database for relevant information\n**Status:** Completed successfully"
              }
            ],
            "sentAt": "2025-09-03T15:20:01.000Z"
          },
          {
            "id": "assistant-tool-msg-1",
            "role": "assistant",
            "content": [
              {
                "kind": "text",
                "content": "I'll use the search_database tool to find your account information."
              },
              {
                "kind": "tool_use",
                "tool_use": {
                  "name": "search_database",
                  "input": {
                    "query": "customer_id:12345",
                    "fields": ["name", "email", "plan"]
                  }
                }
              }
            ],
            "sentAt": "2025-09-03T15:20:02.000Z"
          },
          {
            "id": "system-tool-msg-2",
            "role": "system",
            "content": [
              {
                "kind": "text",
                "content": "**Tool Name:** `email_validator`\n**Description:** Validating email address format\n**Status:** Validation passed"
              }
            ],
            "sentAt": "2025-09-03T15:20:03.000Z"
          },
          {
            "id": "assistant-tool-msg-2",
            "role": "assistant",
            "content": [
              {
                "kind": "text",
                "content": "Using the email_validator function to verify your contact information."
              },
              {
                "kind": "tool_use",
                "tool_use": {
                  "name": "email_validator",
                  "input": {
                    "email": "customer@example.com"
                  }
                }
              }
            ],
            "sentAt": "2025-09-03T15:20:04.000Z"
          }
        ]
      }
    }
  ]
};

export const mockAttributesResponse: AttributesResponse = {
  "meta": {
    "success": true,
    "status": "pending",
    "scheduledFor": "2025-09-03T12:22:21.259Z"
  }
};

export const mockBulkAttributesResponse: BulkAttributesResponse = {
  "results": [
    {
      "threadId": {
        "threadId": "home/01990f50-31de-72fd-89a6-d08b5b3d9a8f"
      },
      "meta": {
        "success": true,
        "status": "pending",
        "scheduledFor": "2025-09-03T12:22:21.259Z"
      }
    },
    {
      "threadId": {
        "threadId": "internet/01990f50-31de-72fd-89a6-d08b5b3d9a8e"
      },
      "meta": {
        "success": true,
        "status": "completed",
        "scheduledFor": "2025-09-03T12:20:00.000Z"
      }
    }
  ],
  "errors": [
    {
      "threadId": {
        "threadId": "invalid/thread-id"
      },
      "code": "INVALID_ID",
      "message": "Invalid thread ID"
    }
  ]
};