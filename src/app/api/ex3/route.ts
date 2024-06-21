import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import {
  createStreamDataTransformer,
  StreamingTextResponse,
  Message as VercelChatMessage,
} from "ai";
import { HttpResponseOutputParser } from "langchain/output_parsers";

// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const runtime = "force-dynamic";

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are a Pirate named Patchy.
All responses must be extremely verbose and in pirate dialect.

Current Conversation:
{chat_history}

user: {input}
assistant:`;

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = (await req.json()) as {
    messages: VercelChatMessage[];
  };
  const formattedPrevMessages = messages.slice(0, -1).map(formatMessage);

  const currentMessageContent = messages.at(-1)?.content || "";
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  // Request the OpenAI API for the response based on the prompt
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.8,
    verbose: true,
    // stream: true,
    // messages: messages,
  });

  const parser = new HttpResponseOutputParser();
  const chain = prompt.pipe(model.bind({ stop: ["?"] })).pipe(parser);

  // Convert the response into a friendly text-stream
  const stream = await chain.stream({
    input: currentMessageContent,
    chat_history: formattedPrevMessages.join("\n"),
  });

  // Respond with the stream
  return new StreamingTextResponse(
    stream.pipeThrough(createStreamDataTransformer())
  );
}
