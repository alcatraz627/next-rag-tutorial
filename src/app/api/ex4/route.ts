import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import {
  createStreamDataTransformer,
  StreamingTextResponse,
  Message as VercelChatMessage,
} from "ai";
import { HttpResponseOutputParser } from "langchain/output_parsers";

import { RunnableSequence } from "@langchain/core/runnables";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { formatDocumentsAsString } from "langchain/util/document";
// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const dynamic = "force-dynamic";

const loader = new JSONLoader("src/data/states.json", [
  "/state",
  "/code",
  "/nickname",
  "/website",
  "/admission_date",
  "/admission_number",
  "/capital_city",
  "/capital_url",
  "/population",
  "/population_rank",
  "/constitution_url",
  "/twitter_url",
]);

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `Answer the user's questions based only on the following context. 
// If the answer is not in the context, reply that you do not have that information available.:
==============================
Context: {context}
==============================
Current conversation: {chat_history}

user: {question}
assistant:`;

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = (await req.json()) as {
    messages: VercelChatMessage[];
  };
  const formattedPrevMessages = messages.slice(0, -1).map(formatMessage);

  const currentMessageContent = messages.at(-1)?.content || "";
  const docs = await loader.load();

  const prompt = PromptTemplate.fromTemplate(TEMPLATE);
  prompt.inputVariables;

  // Request the OpenAI API for the response based on the prompt
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.8,
    verbose: true,
    streaming: true,
    // stream: true,
    // messages: messages,
  });

  const parser = new HttpResponseOutputParser();
  // const chain = prompt.pipe(model.bind({ stop: ["?"] })).pipe(parser);
  const chain = RunnableSequence.from([
    {
      question: (input) => input.question,
      chat_history: (input) => input.chat_history,
      context: () => formatDocumentsAsString(docs),
    },
    prompt,
    model,
    parser,
  ]);

  // console.log(formatDocumentsAsString(docs));

  // Convert the response into a friendly text-stream
  const stream = await chain.stream({
    question: currentMessageContent,
    chat_history: formattedPrevMessages.join("\n"),
  });

  // Respond with the stream
  return new StreamingTextResponse(
    stream.pipeThrough(createStreamDataTransformer())
  );
}
