from pydantic import BaseModel


class MoodQuizQuestion(BaseModel):
    question: str
    options: list[str]


class MoodQuizAnswer(BaseModel):
    question: str
    answer: str


class MoodQuizAnswerRequest(BaseModel):
    answers: list[MoodQuizAnswer]
